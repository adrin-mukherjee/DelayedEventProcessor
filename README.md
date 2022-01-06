# DelayedEventProcessor
Sample Lambda function that can be used to schedule API requests at a specified time in the future.
The function can act as API backend for an API Gateway Lambda proxy integration and expects the event to have the following ISO 8601 format:

```
{
    ...
    "body": "{\n  \"triggerAt\": \"YYYY-MM-DDThh:mm:ss.zzz+hh:mm\"}",
    ...
}
```

In short, the body must contain the "triggerAt" field which in turn, must carry an ISO-8601 formatted timestamp along with zone offset.

The function performs the following steps:
- Generates a correlation ID
- Retrieves the future timestamp from "triggerAt" field and generated a cron expression
- Makes API calls to create a new rule in Amazon EventBridge's "default" event bus
- Configures this newly created rule with a pre-defined Lambda target and pass the rule name, correlation ID, and the incoming request 
  (The rule name is passed so that the target Lambda can delete the rule from EventBridge once request processing is over)
- Returns acknowledgement along with a correlation ID 

### Configuration parameters
The function can be configured with the following environment variables:
- **REGION**: AWS region code (defaults to ap-south-1)
- **TARGET_LAMBDA_ARN**: ARN of the Amazon EventBridge rule target. This function assumes another Lambda target 
- **RULE_PREFIX**: The prefix used to create Amazon EventBridge rules (defaults to 'delayed_exec_rule_'). If the prefix changes, the IAM policies will also have to change


### Note: 
This sample contains 2 IAM policies that needs to be changed to reflect the correct AWS region code and AWS account ID
- iam_policy-DelayedEventProcessor.json : The execution policy of this Lambda
- target_resource_based_policy.json : The resource based policy of the target lambda

### Reference:
For further details on the solution, please refer to the following blog:  
