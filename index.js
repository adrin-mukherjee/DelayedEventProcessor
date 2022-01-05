const AWS  = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const REGION = process.env.REGION || 'ap-south-1';
const TARGET_LAMBDA_ARN = process.env.TARGET_LAMBDA_ARN || "arn:aws:lambda:<region-code>:<account-id>:function:hello"; 
const RULE_PREFIX = process.env.RULE_PREFIX || "delayed_exec_rule_";

/*
    Assumptions: 
    1. This lambda function is a API backend configured with Lambda Proxy integration type
    2. The request body has a field named "triggerAt" that contains a future timestamp in the format: "2022-01-01T00:00:00.000+05:30
 */
exports.handler = async (event) => {   
    AWS.config.update({region: REGION});
    let corr_id = uuidv4(); // correlation identifier
    let response = {};

    console.log(`Incoming event >  ${JSON.stringify(event)}`);
    
    try{
        let req = JSON.parse(event.body);
        console.log("Request body = ", JSON.stringify(req));
        let d = new Date(req.triggerAt);  // Assuming event.triggerAt has the timestamp at which an event has to be triggered
        console.log(`[${corr_id}] Delayed event timestamp >  ${d}`);
        
        let schedExpr = generateScheduleExprFromTs(d);
        console.log(`[${corr_id}] Schedule expression > ${schedExpr}`);
        
        var eventbridge = new AWS.EventBridge();
        
        // Create the event rule
        let rule_params = {
          Name: RULE_PREFIX + corr_id,
          Description: 'Generated rule',
          EventBusName: 'default',
          ScheduleExpression: schedExpr,
          State: "ENABLED",  
        };
        
        await eventbridge.putRule(rule_params).promise()
            .then((data)=>{
                console.log(`[${corr_id}] Put rule response > ${JSON.stringify(data)}`); 
                
            }).catch((err)=>{
                console.error(`[${corr_id}] Error during rule creation...`);
                throw err;
            });
        
        // Create event target (Lambda target)
        let target_params = {
            Rule: rule_params.Name,
            Targets:[ 
                {
                  Arn: TARGET_LAMBDA_ARN,
                  Id: "Lambda_target",
                  Input: JSON.stringify({ // This is the event for the target Lambda
                                            rule: rule_params.Name, // Rule name is passed so that after processing the target Lambda can delete the specific rule
                                            correlationId: corr_id, // Correlation ID is passed for tracking purposes
                                            request: req
                                        })     
                }   
            ]
        };
        await eventbridge.putTargets(target_params).promise()
            .then((data)=>{
                console.log(`[${corr_id}] Put target response > ${JSON.stringify(data)}`);
            })
            .catch((err)=>{
                console.error(`[${corr_id}] Error during put target operation...`);
                throw err;
            });
            
        response = { 
            isBase64Encoded: false,
            statusCode: 200, 
            body: JSON.stringify({
                status: "SUCCESS",
                correlationId: corr_id
            })
        };
    }
    catch(err){
        // TODO: At this point, if the rule already got created, then delete the same
        console.error(`[${corr_id}] Error encountered > ${err}`);
        response = { 
            isBase64Encoded: false,
            statusCode: 500, 
            body: JSON.stringify({
                status: "FAILURE",
                correlationId: corr_id
            })
        };          
    }
    return response;
};

function generateScheduleExprFromTs(ts){
    // TODO: Perform more validations on the date 
    if( typeof ts.getMonth === 'function'){ // check if valid date
        return `cron(${ts.getMinutes()} ${ts.getHours()} ${ts.getDate()} ${ts.getMonth()+1} ? *)`;
    }
    else{
        throw Error(`Invalid date in request`);
    }
}