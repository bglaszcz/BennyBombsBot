/**
 * /trial: put a message on trial. Gemini writes the charge, prosecution and
 * defense; the jury votes with buttons; when time runs out Gemini plays judge
 * and reads the sentence based on the vote. Trials live in the DB, so a
 * restart mid-trial just resumes the countdown.
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { UniqueConstraintError } = require('sequelize');
const { Trial, TrialVote } = require('../models');
const { generateJson, generateText } = require('./gemini');
const { trial: trialSettings } = require('../config/settings');
const { getNickname } = require('../utils/getNickname');
const { fetchMessage, getMessageText, truncate } = require('../utils/messages');

const VERDICTS = {
    guilty: { label: 'GUILTY', color: 0xC0392B, emoji: '🔴' },
    innocent: { label: 'NOT GUILTY', color: 0x27AE60, emoji: '🟢' },
    mistrial: { label: 'MISTRIAL', color: 0x95A5A6, emoji: '⚪' },
};

const FALLBACK_CASE = {
    charge: 'Posting with intent to be weird',
    prosecution: 'Your honor, the evidence speaks for itself. Look at it. Just look at it.',
    defense: 'My client was hacked. Or tired. Or both. Mostly both.',
};

function voteButtons(trialId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`trial-vote:${trialId}:guilty`)
            .setLabel('Guilty')
            .setEmoji('🔴')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`trial-vote:${trialId}:innocent`)
            .setLabel('Not Guilty')
            .setEmoji('🟢')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
    );
}

async function writeCase(defendantName, accuserName, quote) {
    const prompt = `You are the court clerk for a mock trial in a Discord server full of close friends. A message has been put on trial.

Defendant (who wrote it): ${defendantName}
Accused by: ${accuserName}
The message: "${quote}"

Write:
- charge: a ridiculous formal-sounding criminal charge for this message (max 15 words), e.g. "First-degree cringe with intent to distribute"
- prosecution: the prosecutor's opening argument (2-3 sentences), dramatic and petty, quoting the evidence
- defense: the defense attorney's argument (2-3 sentences), desperate and creative

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

async function writeSentence(trial, verdict, guilty, innocent) {
    const defendant = getNickname(trial.defendantId, 'the defendant');
    const accuser = getNickname(trial.accuserId, 'the accuser');
    const instructions = {
        guilty: 'Hand down a ridiculous, harmless sentence (e.g. "must use Comic Sans for a week", "banned from saying bro until Friday").',
        innocent: `Acquit them and scold ${accuser} for wasting the court's time.`,
        mistrial: 'Declare a mistrial because the jury couldn\'t decide, and be dramatic about it.',
    }[verdict];

    const prompt = `You are a dramatic TV judge presiding over a mock trial in a Discord server of close friends.
${defendant} was charged with: "${trial.charge}".
The jury voted ${guilty} guilty, ${innocent} not guilty. Verdict: ${VERDICTS[verdict].label}.
${instructions}
Write the ruling in 2-3 sentences. No preamble, no quotation marks.`;

    try {
        return truncate(await generateText(prompt), 900);
    }
    catch (error) {
        console.error('Trial sentence generation failed:', error.message);
        return verdict === 'guilty' ? 'The court sentences you to think about what you did.' : 'Court is adjourned.';
    }
}

/** Close voting, tally, and post the verdict. Safe to call twice. */
async function closeTrial(client, trialId) {
    const [claimed] = await Trial.update({ status: 'closed' }, { where: { id: trialId, status: 'open' } });
    if (!claimed) return;

    const trial = await Trial.findByPk(trialId);
    const votes = await TrialVote.findAll({ where: { trialId }, raw: true });
    const guilty = votes.filter(v => v.vote === 'guilty').length;
    const innocent = votes.length - guilty;
    const verdict = guilty > innocent ? 'guilty' : innocent > guilty ? 'innocent' : 'mistrial';

    const sentence = await writeSentence(trial, verdict, guilty, innocent);
    await trial.update({ verdict });

    const courtMessage = await fetchMessage(client, trial.channelId, trial.messageId);
    if (!courtMessage) return;

    const { label, color, emoji } = VERDICTS[verdict];
    const embed = EmbedBuilder.from(courtMessage.embeds[0])
        .setColor(color)
        .spliceFields(-1, 1, { name: `${emoji} Verdict: ${label} (${guilty}–${innocent})`, value: sentence });

    await courtMessage.edit({ embeds: [embed], components: [voteButtons(trial.id, true)] });
    await courtMessage.reply(`🔨 The jury has spoken: <@${trial.defendantId}> is **${label}**.`);
}

function scheduleClose(client, trial) {
    const delay = Math.max(0, trial.closesAt.getTime() - Date.now());
    setTimeout(() => closeTrial(client, trial.id).catch(error => console.error('Failed to close trial:', error)), delay);
}

/**
 * Open a trial on a message. The interaction must not have been replied to yet.
 * @param {import('discord.js').MessageContextMenuCommandInteraction} interaction
 */
async function startTrial(interaction) {
    const target = interaction.targetMessage;
    const ephemeral = { flags: MessageFlags.Ephemeral };

    if (target.author.bot) {
        return interaction.reply({ content: 'Bots have diplomatic immunity. 🤖', ...ephemeral });
    }
    const existing = await Trial.findOne({ where: { targetMessageId: target.id } });
    if (existing) {
        const link = `https://discord.com/channels/${interaction.guildId}/${existing.channelId}/${existing.messageId}`;
        return interaction.reply({ content: `Double jeopardy! That message [already stood trial](${link}). ⚖️`, ...ephemeral });
    }

    await interaction.deferReply();

    const defendantName = getNickname(target.author.id, target.author.username);
    const quote = getMessageText(target, 500);
    const courtCase = await writeCase(defendantName, getNickname(interaction.user.id, interaction.user.username), quote);
    const closesAt = new Date(Date.now() + trialSettings.votingMinutes * 60 * 1000);

    let trial;
    try {
        trial = await Trial.create({
            targetMessageId: target.id,
            targetUrl: target.url,
            quote,
            defendantId: target.author.id,
            accuserId: interaction.user.id,
            charge: truncate(courtCase.charge, 250),
            channelId: interaction.channelId,
            closesAt,
        });
    }
    catch (error) {
        if (!(error instanceof UniqueConstraintError)) throw error;
        return interaction.editReply('Someone beat you to it — that message is already on trial. ⚖️');
    }

    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle(`⚖️ The People v. ${defendantName}`)
        .setDescription(`**Exhibit A** ([view](${target.url})):\n> ${quote.replace(/\n/g, '\n> ')}\n\nThe jury has until <t:${Math.floor(closesAt.getTime() / 1000)}:t> to vote. The defendant may not vote.`)
        .addFields(
            { name: '📜 Charge', value: truncate(courtCase.charge, 250) },
            { name: '🔴 Prosecution', value: truncate(courtCase.prosecution, 1000) },
            { name: '🔵 Defense', value: truncate(courtCase.defense, 1000) },
            // Last field is replaced by the verdict when voting closes
            { name: '🗳️ Jury', value: 'No votes yet' },
        )
        .setFooter({ text: `Case #${trial.id} • brought by ${getNickname(interaction.user.id, interaction.user.username)}` });

    const courtMessage = await interaction.editReply({
        content: `<@${target.author.id}>, you've been summoned to court.`,
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

module.exports = { startTrial, handleTrialVote, closeTrial, resumeTrials };
