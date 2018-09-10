module.exports={

    convertDiagramToBot: function(diagram)
    {
        var goObj=JSON.parse(diagram);
        var botObject=[];
        for(var f=0;f<goObj.nodeDataArray.length;f++)
        {
            var gO=goObj.nodeDataArray[f];
    
            var toLink=[];
            for(var g=0;g<goObj.linkDataArray.length;g++)
            {
                var gL=goObj.linkDataArray[g];
                if (gL.from==gO.key){
                    toLink.push({to:gL.to, text:(gL.text== undefined) ? "" : gL.text});
                }
            }
            botObject.push({ key: gO.key, text: gO.text, type: gO.type, next:toLink, 
                    parVar:gO.parVar, parURL:gO.parURL, parKey:gO.parKey, parTyp:gO.parTyp, parLMI:gO.parLMI,
                    parCon:gO.parCon, parPar:gO.parPar, parCar:gO.parCar, parAPI:gO.parAPI, parAPO:gO.parAPO
                })
        }
        return botObject;
    },
    
    getBotPointerIndexFromKey:function(myBot,key)
    {
        for(var f=0;f<myBot.length;f++)
        {
            if (myBot[f].key.toString()==key)
            {
                return f;
            }
        }			
        return 0;
    },
    
    getNextOptionFromText:function(myBotThread, text)
    {
        for(var g=0;g<myBotThread.next.length;g++){
            if (myBotThread.next[g].text.toUpperCase()==text.toUpperCase()){
                return myBotThread.next[g].to;
            }
        }
        return -1;
    },
    
    getSuggestedActions: function (title,items) {
        const { MessageFactory,ActionTypes } = require('botbuilder');
        var suggestedActions = [];
        for(var f=0;f<items.length;f++)
        {
            suggestedActions.push({
                type: ActionTypes.ImBack,
                title: items[f].text,
                value: items[f].text
            });
        }
        return MessageFactory.suggestedActions(suggestedActions, title);
    },
    
    MoveBotPointer:async function(myBot,botPointer,lastMessage,UserActivityResults,state)
    {
        //MOVENEXT
        //IF THIS IS LUIS, need to process it first
        if (myBot[botPointer].type=="IF")
        {
            var ifCond=myBot[botPointer].parCon;
            this.log("IF ORIGINAL:" + ifCond);
            for(var key in UserActivityResults){
                ifCond=ifCond.replace("{" + key + "}",UserActivityResults[key]);
            }
            this.log("IF:" + ifCond);
            const nodeeval=require('node-eval');
            var result=nodeeval(ifCond);
            this.log("RESULT:" + result);
            var op=this.getNextOptionFromText(myBot[botPointer],result.toString());
            botPointer=this.getBotPointerIndexFromKey(myBot,op);
            this.log("new botPointer:" + botPointer)
        }
        else
        if (myBot[botPointer].type=="LUIS")
        {
            var URL=myBot[botPointer].parURL + myBot[botPointer].parKey + "&verbose=false&timezoneOffset=0&q=" + lastMessage;
            //this.log("LUIS:" + URL)
            var request = require('request-promise');
            var body=await request(URL);
            //this.log(body);
            var LUISResult=JSON.parse(body);
            var intent=LUISResult.topScoringIntent.intent;
    
            var parLMI= myBot[botPointer].parLMI;
            this.log("INTENT:" + intent + "LMI:" + parLMI); 
            if (parLMI)
                if (LUISResult.topScoringIntent.score<Number(parLMI)){
                    var intent="None";
                }
            var option=this.getNextOptionFromText(myBot[botPointer],intent);
            if (option==-1)
            {
                this.error("01:no possible option, there should be a None intent!");
            }
            else
                botPointer=this.getBotPointerIndexFromKey(myBot,option);
        }
        else
        {
            // NO CONTINUATION
            if (myBot[botPointer].next.length==0)
                botPointer=0;
            else
                //ONLY ONE OPTION, MOVE NEXT, find the item
                if (myBot[botPointer].next.length==1)
                {
                    botPointer=this.getBotPointerIndexFromKey(myBot,myBot[botPointer].next[0].to)
                }
                else
                {
                    var option=this.getNextOptionFromText(myBot[botPointer],lastMessage);
                    if (option==-1)
                    {
                        this.error("02:no possible option!");
                    }
                    else
                        botPointer=this.getBotPointerIndexFromKey(myBot,option);
        
                }
            
        }
        state.pointer=botPointer;
        state.pointerKey=myBot[botPointer].key;
    
        return botPointer;
    },
    
    AsyncPromiseReadBotFromAzure:async function(storage,botName){
        this.log("ReadBot:" + botName );
        return JSON.parse(await this.PromiseReadBotFromAzure(storage,botName));
    },
    
    PromiseReadBotFromAzure:function(storage,botName){
        return new Promise((resolve,reject) => {
        this.ReadBotFromAzure(storage,botName,
            function(blobContent) {
                resolve(blobContent);
        });
    });
    },
    
    ReadBotFromAzure:function(AzureStorage, blobName,callback)
    {
        //READ IT FROM AZURE STORAGE
        var blobService = AzureStorage.createBlobService();
        var containerName = process.env.BOTFLOW_CONTAINER;
    
        blobService.getBlobToText(
            containerName,
            blobName,
            function(err, blobContent, blob) {
                if (err) {
                    this.error("07:Couldn't download blob " + blobName);
                    this.error(err);
                    callback("");
                } else {
                    callback(blobContent);
                }
            });
    },
    
    shallowCopy:function(value){
        if (Array.isArray(value)) { return value.slice(0); }
        if (typeof value === 'object') { return {...value}; }
        return value;
    },
    
    guid:function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      },
    
    log:function(message){
        console.log("  log:" + message);
    },
    error:function(message){
        console.log(" ERROR:" + message);
    },
    
    RenderConversationThread: async function (storage, state, session, context, dc, myBot)
    {
        var UserActivityResults = state.UserActivityResults === undefined ? state.UserActivityResults={} : state.UserActivityResults;
        var botPointer = state.pointer === undefined ? state.pointer=0 : state.pointer;
        
        var currentThread=myBot[botPointer];
        var messageToDisplay=currentThread.text;
        //REPLACE { } VARIABLES WITH USER ENTRIES
        for(var key in UserActivityResults){
            messageToDisplay=messageToDisplay.replace("{" + key + "}",UserActivityResults[key]);
        }
        this.log("THREAD:" + currentThread.type);
        var messageToSpeak=messageToDisplay;
        switch (currentThread.type) {
            case "IF":
                botPointer=await this.MoveBotPointer(myBot,botPointer,context.activity.text,UserActivityResults,state);
    
                await this.RenderConversationThread(storage, state, session, context, dc, myBot);
                break;
            case "MESSAGE":
                await context.sendActivity(messageToDisplay, messageToSpeak, 'expectingInput');
                botPointer=await this.MoveBotPointer(myBot,botPointer,context.activity.text,UserActivityResults,state);
        
                await this.RenderConversationThread(storage, state, session, context, dc, myBot);
                break;
            case "INPUT":
                await context.sendActivity(messageToDisplay, messageToSpeak, 'expectingInput');
                //await dc.prompt('textPrompt', messageToDisplay);
                break;
            case "CHOICE":
                await context.sendActivity(this.getSuggestedActions(messageToDisplay,currentThread.next));
                break;
            case "LUIS":
                await context.sendActivity(messageToDisplay, messageToSpeak, 'expectingInput');
                break;
            case "START":
                await context.sendActivity(messageToDisplay, messageToSpeak, 'expectingInput');
    
                botPointer=await this.MoveBotPointer(myBot,botPointer,context.activity.text,UserActivityResults,state);
        
                await this.RenderConversationThread(storage, state, session, context, dc, myBot);
                break;
        
            default:
                await context.sendActivity(messageToDisplay, messageToSpeak, 'expectingInput');
                botPointer=await this.MoveBotPointer(myBot,botPointer,context.activity.text,UserActivityResults,state);
                break;
        }
    },
    
    WriteBotControl:function(storage,session, savedAddress){
        var b=JSON.stringify(savedAddress);
        //WRITE IT IN AZURE STORAGE
        var blobService = storage.createBlobService();
        var containerName = process.env.BOTFLOW_CONTAINER_CONTROL;
            blobService.createBlockBlobFromText(
            containerName,
            session,
            b,
            function(error, result, response){
                if(error){
                    this.error("06:Couldn't upload string");
                    this.error(error);
                }
            });
    },
    
    PreProcessing:async function(state,myBot,botPointer,messageText){
        var UserActivityResults = state.UserActivityResults === undefined ? state.UserActivityResults={} : state.UserActivityResults;
    
        //STORE THE ACTUAL RESULT IN THE VARIABLE
        if (myBot[botPointer].parVar)
        {
            UserActivityResults[myBot[botPointer].parVar]=messageText;
            this.log("Results:" + JSON.stringify(UserActivityResults));
            state.UserActivityResults=UserActivityResults;
        }
    
        //MOVE IT TO THE NEXT
        botPointer=await this.MoveBotPointer(myBot,botPointer,messageText,UserActivityResults,state);
    }
    
    };