import { Configuration, OpenAIApi } from "openai";
const {organization, apiKey} = require('/home/ben/Desktop/BennyBombsBot/config.json');
const configuration = new Configuration ({
    organization: organization,
    apiKey: apiKey
});
const openai = new OpenAIApi(configuration);
const response = await openai.listEngines();