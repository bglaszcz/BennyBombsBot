/**
 * Small Claims Court. Right-click a message → "Sue in Small Claims", name your
 * damages, and pay a court fee up front (held in escrow). Gemini writes the
 * claim and both arguments; the jury votes with buttons; when time runs out
 * the money moves and Gemini plays judge.
 *
 * - Liable:     defendant pays the damages (or everything they have), plaintiff's fee is refunded
 * - Not liable: plaintiff forfeits the fee — part goes to the defendant for emotional distress,
 *               the rest is split among the jurors as jury duty pay
 * - Mistrial:   fee refunded, nobody pays anything
 *
 * Trials live in the DB, so a restart mid-trial just resumes the countdown.
 */
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
    ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { UniqueConstraintError } = require('sequelize');
const { Trial, TrialVote, sequelize } = require('../models');
const { generateJson, generateText } = require('./gemini');
const { adjustCoins, formatCoins, getBalance, InsufficientFundsError } = require('./economy');
const { trial: settings } = require('../config/settings');
const { getNickname } = require('../utils/getNickname');
const { fetchMessage, getMessageText, truncate } = require('../utils/messages');

const VERDICTS = {
    guilty: { label: 'LIABLE', color: 0xC0392B, emoji: '🔴' },
    innocent: { label: 'NOT LIABLE', color: 0x27AE60, emoji: '🟢' },
    mistrial: { label: 'MISTRIAL', color: 0x95A5A6, emoji: '⚪' },
};

const FALLBACK_CASE = {
    charge: 'Emotional damages resulting from a post that should not have been posted',
    prosecution: 'Your honor, my client read this message and has not been the same since. Look at it. Just look at it.',
    defense: 'My client was hacked. Or tired. Or both. Mostly both. Also, the plaintiff has been weird first, many times.',
};

/** Fee the plaintiff pays to file — refunded if they win */
function courtFeeFor(damages) {
    return Math.max(settings.minCourtFee, Math.ceil(damages * settings.courtFeeRate));
}

/** A { id, username } for adjustCoins, from cache if we have it */
function party(client, userId) {
    return { id: userId, username: client.users.cache.get(userId)?.username ?? userId };
}

function voteButtons(trialId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`trial-vote:${trialId}:guilty`)
            .setLabel('Liable — pay up')
            .setEmoji('🔴')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`trial-vote:${trialId}:innocent`)
            .setLabel('Not Liable — case dismissed')
            .setEmoji('🟢')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
    );
}

async function writeCase(defendantName, plaintiffName, quote, damages, grievance) {
    const prompt = `You are the court clerk for a mock small claims court in a Discord server full of close friends.
${plaintiffName} is suing ${defendantName} over a message, seeking ${damages} Bomb Bucks (the server's fake currency) in damages.

The message: "${quote}"
${grievance ? `The plaintiff's stated grievance: "${grievance}"` : 'The plaintiff did not explain themselves.'}

Write:
- charge: the formal claim as it appears on the court docket (max 15 words), ridiculous and legalistic, e.g. "Negligent infliction of cringe resulting in loss of will to scroll"
- prosecution: the plaintiff's lawyer's argument (2-3 sentences) — petty, dramatic, quotes the evidence, and itemizes the damages in an absurd way (e.g. "40 for emotional distress, 20 for the eye roll")
- defense: the defendant's lawyer's argument (2-3 sentences) — desperate, creative, maybe a countersuit threat or an absurd technicality

Keep it affectionate roast humor. Nothing about appearance, race, religion, gender, sexuality, or disability.
Return ONLY JSON: {"charge": "...", "prosecution": "...", "defense": "..."}`;

    try {
        const result = await generateJson(prompt);
        if (result?.charge && result.prosecution && result.defense) return result;
    }
    catch (error) {
        console.error('Trial case generation failed:', error.message);
    }
    return FALLBACK_CASE;
}

async function writeSentence(trial, verdict, guilty, innocent, outcome) {
    const defendant = getNickname(trial.defendantId, 'the defendant');
    const plaintiff = getNickname(trial.accuserId, 'the plaintiff');
    const instructions = {
        guilty: outcome.paid < trial.damages
            ? `Rule for ${plaintiff}. ${defendant} owed ${trial.damages} Bomb Bucks but only had ${outcome.paid}, so the court garnished every last one. Be dramatic about how broke they are.`
            : `Rule for ${plaintiff} and order ${defendant} to pay the full ${trial.damages} Bomb Bucks. Add a ridiculous, harmless extra condition (e.g. "and must use Comic Sans for a week").`,
        innocent: `Dismiss the case and scold ${plaintiff} for wasting the court's time with a frivolous lawsuit. They forfeit their ${trial.courtFee} Bomb Buck court fee, some of which goes to ${defendant} for emotional distress.`,
        mistrial: 'Declare a mistrial because the jury couldn\'t decide, and be dramatic about it. Everyone gets their money back.',
    }[verdict];

    const prompt = `You are a dramatic TV small claims court judge (think Judge Judy) in a Discord server of close friends.
${plaintiff} sued ${defendant} for ${trial.damages} Bomb Bucks over: "${trial.charge}".
The jury voted ${guilty} liable, ${innocent} not liable. Verdict: ${VERDICTS[verdict].label}.
${instructions}
Write the ruling in 2-3 sentences. No preamble, no quotation marks.`;

    try {
        return truncate(await generateText(prompt), 900);
    }
    catch (error) {
        console.error('Trial sentence generation failed:', error.message);
        return verdict === 'guilty' ? 'Pay the man. Court is adjourned.' : 'Get out of my courtroom.';
    }
}

/**
 * Move the money for a verdict. Runs in the same transaction that closes the trial,
 * so it happens exactly once.
 * @returns {{ paid?: number, toDefendant?: number, perJuror?: number, jurors?: number }}
 */
async function settleDamages(client, trial, verdict, jurorIds, transaction) {
    if (!trial.damages) return {};
    const plaintiff = party(client, trial.accuserId);

    if (verdict === 'guilty') {
        let paid = trial.damages;
        try {
            await adjustCoins(party(client, trial.defendantId), -paid, transaction);
        }
        catch (error) {
            if (!(error instanceof InsufficientFundsError)) throw error;
            // Can't pay in full: the court takes whatever's there
            paid = error.balance;
            if (paid > 0) await adjustCoins(party(client, trial.defendantId), -paid, transaction);
        }
        await adjustCoins(plaintiff, paid + trial.courtFee, transaction);
        return { paid };
    }

    if (verdict === 'innocent') {
        // Fee was taken at filing. Jurors split their share; rounding leftovers go to the defendant.
        const juryPot = Math.floor(trial.courtFee * (1 - settings.defendantShareOfFees));
        const perJuror = jurorIds.length ? Math.floor(juryPot / jurorIds.length) : 0;
        const toDefendant = trial.courtFee - perJuror * jurorIds.length;
        if (toDefendant > 0) await adjustCoins(party(client, trial.defendantId), toDefendant, transaction);
        if (perJuror > 0) {
            for (const id of jurorIds) await adjustCoins(party(client, id), perJuror, transaction);
        }
        return { toDefendant, perJuror, jurors: jurorIds.length };
    }

    await adjustCoins(plaintiff, trial.courtFee, transaction);
    return {};
}

function outcomeText(trial, verdict, outcome) {
    if (!trial.damages) return '';
    const plaintiff = `<@${trial.accuserId}>`;
    const defendant = `<@${trial.defendantId}>`;

    if (verdict === 'guilty') {
        const broke = outcome.paid < trial.damages
            ? `\n🧹 They only had ${formatCoins(outcome.paid)}. The court garnished it all. Judgment-proof AND guilty.`
            : '';
        return `\n💸 ${defendant} pays ${plaintiff} ${formatCoins(outcome.paid)} in damages. Filing fee refunded.${broke}`;
    }
    if (verdict === 'innocent') {
        const jury = outcome.perJuror > 0
            ? ` and ${formatCoins(outcome.perJuror)} each to ${outcome.jurors} juror${outcome.jurors !== 1 ? 's' : ''} for jury duty`
            : '';
        return `\n🧾 Frivolous lawsuit! ${plaintiff} forfeits the ${formatCoins(trial.courtFee)} court fee: ${formatCoins(outcome.toDefendant)} to ${defendant} for emotional distress${jury}.`;
    }
    return `\n↩️ ${plaintiff}'s filing fee is refunded. Nobody pays. Everybody go home.`;
}

/** Close voting, tally, move the money, and post the verdict. Safe to call twice. */
async function closeTrial(client, trialId) {
    const closed = await sequelize.transaction(async transaction => {
        const [claimed] = await Trial.update({ status: 'closed' }, { where: { id: trialId, status: 'open' }, transaction });
        if (!claimed) return null;

        const trial = await Trial.findByPk(trialId, { transaction });
        const votes = await TrialVote.findAll({ where: { trialId }, raw: true, transaction });
        const guilty = votes.filter(v => v.vote === 'guilty').length;
        const innocent = votes.length - guilty;
        const verdict = guilty > innocent ? 'guilty' : innocent > guilty ? 'innocent' : 'mistrial';

        const outcome = await settleDamages(client, trial, verdict, votes.map(v => v.userId), transaction);
        await trial.update({ verdict, awarded: outcome.paid ?? 0 }, { transaction });
        return { trial, verdict, guilty, innocent, outcome };
    });
    if (!closed) return;

    const { trial, verdict, guilty, innocent, outcome } = closed;
    const sentence = await writeSentence(trial, verdict, guilty, innocent, outcome);

    const courtMessage = await fetchMessage(client, trial.channelId, trial.messageId);
    if (!courtMessage) return;

    const { label, color, emoji } = VERDICTS[verdict];
    const embed = EmbedBuilder.from(courtMessage.embeds[0])
        .setColor(color)
        .spliceFields(-1, 1, { name: `${emoji} Verdict: ${label} (${guilty}–${innocent})`, value: sentence });

    await courtMessage.edit({ embeds: [embed], components: [voteButtons(trial.id, true)] });
    await courtMessage.reply(`🔨 The jury has spoken: <@${trial.defendantId}> is **${label}**.${outcomeText(trial, verdict, outcome)}`);
}

function scheduleClose(client, trial) {
    const delay = Math.max(0, trial.closesAt.getTime() - Date.now());
    setTimeout(() => closeTrial(client, trial.id).catch(error => console.error('Failed to close trial:', error)), delay);
}

/**
 * Right-click → Sue in Small Claims. Checks the target, then opens the filing form.
 * @param {import('discord.js').MessageContextMenuCommandInteraction} interaction
 */
async function startTrial(interaction) {
    const target = interaction.targetMessage;
    const ephemeral = { flags: MessageFlags.Ephemeral };

    if (target.author.bot) {
        return interaction.reply({ content: 'Bots have diplomatic immunity. 🤖', ...ephemeral });
    }
    if (target.author.id === interaction.user.id) {
        return interaction.reply({ content: 'You can\'t sue yourself. Well, you can, but it\'s called therapy. 🛋️', ...ephemeral });
    }
    const existing = await Trial.findOne({ where: { targetMessageId: target.id } });
    if (existing) {
        const link = `https://discord.com/channels/${interaction.guildId}/${existing.channelId}/${existing.messageId}`;
        return interaction.reply({ content: `Double jeopardy! That message [already went to court](${link}). ⚖️`, ...ephemeral });
    }

    const exampleFee = courtFeeFor(settings.maxDamages);
    const modal = new ModalBuilder()
        .setCustomId(`trial-file:${target.channelId}:${target.id}`)
        .setTitle(`Small Claims v. ${truncate(getNickname(target.author.id, target.author.username), 28)}`)
        .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId('damages')
                .setLabel(`Damages sought (${settings.minDamages}-${settings.maxDamages} Bomb Bucks)`)
                .setPlaceholder(`Court fee is ${Math.round(settings.courtFeeRate * 100)}% (e.g. ${exampleFee} on a ${settings.maxDamages} claim), refunded if you win`)
                .setStyle(TextInputStyle.Short)
                .setMaxLength(5)
                .setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder()
                .setCustomId('grievance')
                .setLabel('Describe your suffering (optional)')
                .setPlaceholder('I read this message and lost the will to scroll.')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(200)
                .setRequired(false)),
        );
    await interaction.showModal(modal);
}

/** "trial-file:<channelId>:<messageId>" modal submit — pays the fee and opens court */
async function handleTrialFiling(interaction) {
    const [, channelId, messageId] = interaction.customId.split(':');
    const ephemeral = { flags: MessageFlags.Ephemeral };

    const damages = Number.parseInt(interaction.fields.getTextInputValue('damages').replace(/[,\s]/g, ''), 10);
    if (!Number.isInteger(damages) || damages < settings.minDamages || damages > settings.maxDamages) {
        return interaction.reply({
            content: `The court only hears claims between ${formatCoins(settings.minDamages)} and ${formatCoins(settings.maxDamages)}. This is small claims, not the Supreme Court. 🏛️`,
            ...ephemeral,
        });
    }
    const grievance = interaction.fields.getTextInputValue('grievance')?.trim() || null;
    const courtFee = courtFeeFor(damages);

    const target = await fetchMessage(interaction.client, channelId, messageId);
    if (!target) return interaction.reply({ content: 'The evidence has vanished. Case dismissed. 🕵️', ...ephemeral });

    const balance = await getBalance(interaction.user.id);
    if (balance < courtFee) {
        return interaction.reply({
            content: `Filing a ${formatCoins(damages)} claim costs ${formatCoins(courtFee)} in court fees, and you've got ${formatCoins(balance)}. Lawyers aren't free. 💼`,
            ...ephemeral,
        });
    }

    await interaction.deferReply();

    const defendantName = getNickname(target.author.id, target.author.username);
    const plaintiffName = getNickname(interaction.user.id, interaction.user.username);
    const quote = getMessageText(target, 500);
    const courtCase = await writeCase(defendantName, plaintiffName, quote, damages, grievance);
    const closesAt = new Date(Date.now() + settings.votingMinutes * 60 * 1000);

    let trial;
    try {
        // The fee and the case go in together: no case without a fee, no fee without a case
        trial = await sequelize.transaction(async transaction => {
            await adjustCoins(interaction.user, -courtFee, transaction);
            return Trial.create({
                targetMessageId: target.id,
                targetUrl: target.url,
                quote,
                defendantId: target.author.id,
                accuserId: interaction.user.id,
                charge: truncate(courtCase.charge, 250),
                damages,
                courtFee,
                grievance,
                channelId: interaction.channelId,
                closesAt,
            }, { transaction });
        });
    }
    catch (error) {
        if (error instanceof UniqueConstraintError) {
            return interaction.editReply('Someone beat you to it — that message is already in court. ⚖️');
        }
        if (error instanceof InsufficientFundsError) {
            return interaction.editReply('You spent your court fee while the clerk was typing. Case dismissed. 💸');
        }
        throw error;
    }

    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle(`⚖️ Small Claims Court: ${plaintiffName} v. ${defendantName}`)
        .setDescription(
            `**Exhibit A** ([view](${target.url})):\n> ${quote.replace(/\n/g, '\n> ')}\n` +
            (grievance ? `\n**Plaintiff's statement:** *"${grievance}"*\n` : '') +
            `\nThe jury has until <t:${Math.floor(closesAt.getTime() / 1000)}:t> to vote. ` +
            'The plaintiff and defendant may not vote. Jurors get paid if the case is thrown out.',
        )
        .addFields(
            { name: '📜 Claim', value: truncate(courtCase.charge, 250) },
            { name: '💰 Damages sought', value: `${formatCoins(damages)} • Court fee in escrow: ${formatCoins(courtFee)}`, inline: true },
            { name: '🔴 Plaintiff\'s counsel', value: truncate(courtCase.prosecution, 1000) },
            { name: '🔵 Defense', value: truncate(courtCase.defense, 1000) },
            // Last field is replaced by the verdict when voting closes
            { name: '🗳️ Jury', value: 'No votes yet' },
        )
        .setFooter({ text: `Case #${trial.id} • Loser pays. Lose and the plaintiff's fee goes to the defendant and the jury.` });

    const courtMessage = await interaction.editReply({
        content: `<@${target.author.id}>, you're being sued for ${formatCoins(damages)}. Court is in session. 🔨`,
        embeds: [embed],
        components: [voteButtons(trial.id)],
    });
    await trial.update({ messageId: courtMessage.id });
    scheduleClose(interaction.client, trial);
}

/** "trial-vote:<trialId>:<vote>" buttons */
async function handleTrialVote(interaction) {
    const [, trialId, vote] = interaction.customId.split(':');
    const ephemeral = { flags: MessageFlags.Ephemeral };

    const trial = await Trial.findByPk(trialId);
    if (!trial || trial.status !== 'open' || trial.closesAt < new Date()) {
        return interaction.reply({ content: 'Court is adjourned. The gavel has dropped. 🔨', ...ephemeral });
    }
    if (interaction.user.id === trial.defendantId) {
        return interaction.reply({ content: 'Nice try. The defendant doesn\'t get a vote. 🙅', ...ephemeral });
    }
    // Old trials (no money on the line) let the accuser vote; small claims doesn't
    if (trial.damages && interaction.user.id === trial.accuserId) {
        return interaction.reply({ content: 'You\'re the plaintiff. That\'s called a conflict of interest. 🙅', ...ephemeral });
    }

    await TrialVote.upsert({ trialId: trial.id, userId: interaction.user.id, vote }, { conflictFields: ['trialId', 'userId'] });
    const count = await TrialVote.count({ where: { trialId: trial.id } });

    // Secret ballot: only the number of votes is public
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .spliceFields(-1, 1, { name: '🗳️ Jury', value: `${count} juror${count !== 1 ? 's have' : ' has'} voted` });
    await interaction.update({ embeds: [embed] });
    await interaction.followUp({
        content: `You voted **${VERDICTS[vote].label}**. You can change it until the gavel drops.`,
        ...ephemeral,
    });
}

/** On startup, pick back up any trials that were open when the bot went down */
async function resumeTrials(client) {
    const open = await Trial.findAll({ where: { status: 'open' } });
    for (const trial of open) scheduleClose(client, trial);
    if (open.length > 0) console.log(`⚖️ Resumed ${open.length} open trial(s)`);
}

module.exports = { startTrial, handleTrialFiling, handleTrialVote, closeTrial, resumeTrials };
