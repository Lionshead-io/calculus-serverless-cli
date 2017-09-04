export default [{
    "aws_lambda_alias": {
        "dev_alias": {
            "name": "dev",
            "description": "dev",
            "function_name": "${aws_lambda_function.calculus_generated_function.arn}",
            "function_version": "$LATEST"
        }
    }
}, {
    "aws_lambda_alias": {
        "qa_alias": {
            "name": "qa",
            "description": "qa",
            "function_name": "${aws_lambda_function.calculus_generated_function.arn}",
            "function_version": "$LATEST"
        }
    }
}, {
    "aws_lambda_alias": {
        "preprod_alias": {
            "name": "preprod",
            "description": "preprod",
            "function_name": "${aws_lambda_function.calculus_generated_function.arn}",
            "function_version": "$LATEST"
        }
    }
}, {
    "aws_lambda_alias": {
        "prod_alias": {
            "name": "prod",
            "description": "prod",
            "function_name": "${aws_lambda_function.calculus_generated_function.arn}",
            "function_version": "$LATEST"
        }
    }
}];