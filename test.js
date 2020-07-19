#! /usr/bin/env node
/***********************************************
 * @Author: Frodo Cheng
 * @Time: 2020-07-10 15:55:00
***********************************************/
var FCLogger = require('./FCLogger');

FCLogger.LogOpen('output.log', FCLogger.LOG_LVL_LOW);

var beg = Date.now();
var loop_cnt = 1;

for (let i = 0; i < loop_cnt; i++)
{
    FCLogger.LogError("Hello, World !");
    FCLogger.LogCrit("Hello, World !");
    FCLogger.LogWarn("Hello, World !");
    FCLogger.LogDbg("Hello, World !");
    FCLogger.LogInfo("Hello, World !");
    FCLogger.LogVbs("Hello, World !");
    FCLogger.LogVbs("");
    FCLogger.LogVbs();
}

console.log(FCLogger.LoggerConfigInfo());

FCLogger.LogClose();
var end = Date.now();
console.log(end - beg);
