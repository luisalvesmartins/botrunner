//#region REQUIRE
const { BotFrameworkAdapter, ConsoleAdapter, ConversationState, MemoryStorage } = require('botbuilder');
const restify = require('restify');
const alexa= require('./alexaBridge/alexaBridge.js')
const { botrunner } = require('./botrunner');
require('dotenv').config();
//#endregion

//#region initializations
alexa.start();
var adapter;
// Create adapter
if (process.env.CONSOLE=='YES')
    adapter = new ConsoleAdapter();
else{
    adapter = new BotFrameworkAdapter({ 
        appId: process.env.MICROSOFT_APP_ID, 
        appPassword: process.env.MICROSOFT_APP_PASSWORD
    });

	// Catch-all for any unhandled errors in your bot.
	adapter.onTurnError = async (context, error) => {
		// This check writes out errors to console log .vs. app insights.
		console.error(`\n [onTurnError]: ${ error }`);
		// Send a message to the user
		context.sendActivity(`Oops. Something went wrong!`);
		// Clear out state
		await convoState.clear(context);
		// Save state changes.
		await convoState.saveChanges(context);
	};		
}

//MEMORY: (this is a demo)
const azureStorage = new MemoryStorage();

// Add state middleware
let convoState;
convoState= new ConversationState(azureStorage);

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
	const bot = new botrunner(convoState);
    // Create server
    let server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3978, function () {
        console.log(`${server.name} listening to ${server.url}`);
	});
	//ALEXABRIDGE
	server.use(restify.plugins.bodyParser());
	server.post('/messages', (req, res, err) => alexa.says(req, res, err));
	//BOT
    server.post('/api/messages', (req, res) => {
        adapter.processActivity(req, res, async (context) => {
            await bot.onTurn(context);
        })
	});
}
//#endregion

global.howmany = function howmany (params) {
	if (params.length>2)
	{
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
			const OFFICE_VISIT="#post office visit#post office visits#office visit#post visit#post visits#";
			const ACCESS="#access#portal access#access to portal#portal visit#portal visits#";
			if (ACCOUNTS.indexOf("#" + entity + "#")>-1){
				return "We have 210055 accounts.";
			}
			if (DEPOSIT_ACCOUNTS.indexOf("#" + entity + "#")>-1){
				return "We have 342155 deposit accounts.";
			}
			if (CARDS.indexOf("#" + entity + "#")>-1){
				return "We have 912055 cards activated.";
			}
			if (INSURANCE.indexOf("#" + entity + "#")>-1){
				return "There are 512055 insurance policies active.";
			}
			if (OFFICE_VISIT.indexOf("#" + entity + "#")>-1){
				return "The daily visits are 15733555";
			}
			if (ACCESS.indexOf("#" + entity + "#")>-1){
				return "The number of Poste portal visits are 40950355";
			}

			return "Didn't recognize the entity you are looking for: " + entity + ". I recognize account, deposit account, card, insurance, post office visit, portal visit.";
		}
		else
			return "Could not recognize the entity you are asking for";
	}
	else
		return "Could not understand what you are asking for";
}

global.howmanywere = function howmany (params) {
	if (params.length>2)
	{
		params=params.substring(1,params.length-1);
		console.log("howmanywere was called with " + params);
		var LUISEntities=JSON.parse(params);
		if (LUISEntities.length>0){
			console.log(LUISEntities[0].entity);
			var entity=LUISEntities[0].entity.toLowerCase();

			const ACCOUNTS="#accounts#bank accounts#account#";
			const DEPOSIT_ACCOUNTS="#deposit account#deposit accounts#";
			const CARDS="#card#cards#";
			const INSURANCE="#insurance#insurance policy#insurance policies#policies#";
			const OFFICE_VISIT="#post office visit#post office visits#office visit#visit#visits#";
			const ACCESS="#access#portal access#access to portal#portal visit#portal visits#";
			if (ACCOUNTS.indexOf("#" + entity + "#")>-1){
				return "21009 accounts were opened yesterday";
			}
			if (DEPOSIT_ACCOUNTS.indexOf("#" + entity + "#")>-1){
				return "34219 deposit accounts were opened yesterday";
			}
			if (CARDS.indexOf("#" + entity + "#")>-1){
				return "91209 cards were activated yesterday";
			}
			if (INSURANCE.indexOf("#" + entity + "#")>-1){
				return "51209 insurance policies active yesterday";
			}
			if (OFFICE_VISIT.indexOf("#" + entity + "#")>-1){
				return "The visits yesterday were 1573359";
			}
			if (ACCESS.indexOf("#" + entity + "#")>-1){
				return "The number of Poste portal visits yesterday was 409509";
			}

			return "Didn't recognize the entity you are looking for: " + entity;
		}
		else
			return "Could not recognize the entity you are asking for";
	}
	else
		return "Could not understand what you are asking for";
  }
