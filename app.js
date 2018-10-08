//#region REQUIRE
var lambotenginecore=require('./lambotenginecore');
const { BotFrameworkAdapter, BotStateSet, ConsoleAdapter, ConversationState, MemoryStorage, UserState } = require('botbuilder');
const botbuilder_dialogs = require('botbuilder-dialogs');
const restify = require('restify');
const alexa= require('./alexaBridge/alexaBridge.js')
var storage = require('azure-storage');
require('dotenv').config();
//#endregion

//#region initializations
alexa.start();
var adapter;
// Create adapter
if (process.env.CONSOLE=='YES')
    adapter = new ConsoleAdapter();
else
    adapter = new BotFrameworkAdapter({ 
        appId: process.env.MICROSOFT_APP_ID, 
        appPassword: process.env.MICROSOFT_APP_PASSWORD
    });

//FILE: const azureStorage = new FileStorage("c:/temp");
//MEMORY: (this is a demo)
const azureStorage = new MemoryStorage();

// Add state middleware
const convoState = new ConversationState(azureStorage);
const userState  = new UserState(azureStorage);
adapter.use(new BotStateSet(convoState, userState));
const dialogs = new botbuilder_dialogs.DialogSet();

//FOR CONVERSATION LOGGING
var tableSvc = storage.createTableService();
tableSvc.createTableIfNotExists('botlog', function(error, result, response) {
	if (error) {
		console.log("ERROR");
	  // result contains true if created; false if already exists
	}
  });
var entGen = storage.TableUtilities.entityGenerator;

dialogs.add('textPrompt', new botbuilder_dialogs.TextPrompt());

//#region Start Console or Server
if (process.env.CONSOLE=='YES')
{
    adapter.listen(async (context) => {
		console.log("CONSOLE");
        main(context);
    });
}
else
{
    // Create server
    let server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3979, function () {
        console.log(`${server.name} listening to ${server.url}`);
	});
	//ALEXABRIDGE
	server.use(restify.plugins.bodyParser());
	server.post('/messages', (req, res, err) => alexa.says(req, res, err));
	//BOT
    server.post('/api/messages', (req, res) => {
        adapter.processActivity(req, res, async (context) => {
            await main(context);
        })
	});
}
//#endregion
var botName=process.env.BOTNAME || 'fsi.bot';

async function main(context){
    const state = convoState.get(context);
	var botPointer = state.pointer === undefined ? state.pointer=-1 : state.pointer;
    var session = state.session === undefined ? state.session=lambotenginecore.guid() : state.session;
	const dc = dialogs.createContext(context, state);

	var myBot = await lambotenginecore.AsyncPromiseReadBotFromAzure(storage,botName);
	var initPointer=false;

	if (context.activity.type === 'conversationUpdate' && context.activity.membersAdded[0].name !== 'Bot') {
		 await context.sendActivity("## Welcome to the Bot!","Welcome to the bot");
		 //lambotenginecore.RenderConversationThread(storage, state, session, context, dc, myBot);
	} else
    if (context.activity.type === 'message') {
		if (botPointer==-1)
		{
			initPointer=true;
			botPointer=lambotenginecore.getBotPointerOfStart(myBot);
			state.pointer=botPointer;
			state.pointerKey=myBot[botPointer].key;
			console.log("init pointer");
			botPointer=await lambotenginecore.MoveBotPointer(myBot,botPointer,context.activity.text,state.UserActivityResults,state);
		}

		//PROCESS SPECIAL RESPONSE
		if (context.activity.text.toUpperCase().startsWith("DEBUG"))
		{
			await context.sendActivity("Data collected: " + JSON.stringify(state.UserActivityResults));
			return;
		}

		var task = {
			PartitionKey: entGen.String(context.activity.channelId),
			RowKey: entGen.String(context.activity.id + "|" + context.activity.conversation.id),
			description: entGen.String(context.activity.text),
			botPointer: entGen.Int32(botPointer),
			botName: entGen.String(botName)
		};
		tableSvc.insertEntity(process.env.LOGTABLE || 'botlog',task, function (error, result, response) {
			if(error){
			  // Entity inserted
			  console.log("No save")
			  console.log(task);
			  }
		});
		await lambotenginecore.PreProcessing(state,myBot,botPointer,context.activity.text)

		if(!context.responded){
			// Continue executing the "current" dialog, if any.
			await dc.continue();
		}
		
		if(!context.responded || initPointer){
			await lambotenginecore.RenderConversationThread(storage, state, session, context, dc, myBot)
		}
		

    }
}

global.howmany = function howmany (params) {
	params=params.substring(1,params.length-1);
	console.log("howmany was called with " + params);
	var LUISEntities=JSON.parse(params);
	if (LUISEntities.length>0){
		console.log(LUISEntities[0].entity);
		var entity=LUISEntities[0].entity.toLowerCase();

		const ACCOUNTS="#accounts#bank accounts#account#";
		const DEPOSIT_ACCOUNTS="#deposit account#deposit accounts#";
		const CARDS="#card#cards#";
		const INSURANCE="#insurance#insurance policy#insurance policies#";
		const OFFICE_VISIT="#post office visit#post office visits#office visit#";
		const ACCESS="#access#portal access#access to portal#portal visit#portal visits#";
		if (ACCOUNTS.indexOf("#" + entity + "#")>-1){
			return "We have 2100 accounts.";
		}
		if (DEPOSIT_ACCOUNTS.indexOf("#" + entity + "#")>-1){
			return "We have 3421 deposit accounts.";
		}
		if (CARDS.indexOf("#" + entity + "#")>-1){
			return "We have 9120 cards activated.";
		}
		if (INSURANCE.indexOf("#" + entity + "#")>-1){
			return "There are 5120 insurance policies active.";
		}
		if (OFFICE_VISIT.indexOf("#" + entity + "#")>-1){
			return "The daily visits are 157335.";
		}
		if (ACCESS.indexOf("#" + entity + "#")>-1){
			return "The number of Poste visits are 409503.";
		}

		return "Didn't recognize the entity you are looking for: " + entity;
	}
  }

global.howmanywere = function howmany (params) {
	console.log("howmanywere was called with " + params);
	return "Don't know how to call How many were...";
  }
