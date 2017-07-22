// @flow

import AWS from 'aws-sdk';
import _ from 'lodash';
import R from 'ramda';
import axios from 'axios';
import co from 'co';
const Maybe = require('folktale/maybe');
const Result = require('folktale/result');
const {task} = require('folktale/concurrency/task');

exports.handler = (event, context, callback) => {
    console.log('Hello, %FunctionName%');

    callback(null, 'Hello, %FunctionName%');
};