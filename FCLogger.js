#! /usr/bin/env node
/***********************************************
 * @Author: Frodo Cheng
 * @Time: 2020-07-10 15:55:00
***********************************************/
let fs = require('fs');
let os = require('os');
let process = require('process');

const LOG_LVL_NONE = 0;
const LOG_LVL_ERROR = 1 << 0;
const LOG_LVL_CRIT = 1 << 1;
const LOG_LVL_WARN = 1 << 2;
const LOG_LVL_DBG = 1 << 3;
const LOG_LVL_INFO = 1 << 4;
const LOG_LVL_VBS = 1 << 5;

const LOG_LVL_LOW = LOG_LVL_ERROR | LOG_LVL_CRIT | LOG_LVL_WARN;
const LOG_LVL_HIGH = LOG_LVL_LOW | LOG_LVL_DBG;
const LOG_LVL_ALL = -1;

const LOG_LVL_TAG_ERROR = '[ERR]';
const LOG_LVL_TAG_CRIT = '[CRI]';
const LOG_LVL_TAG_WARN = '[WRN]';
const LOG_LVL_TAG_DBG = '[DBG]';
const LOG_LVL_TAG_INFO = '[INF]';
const LOG_LVL_TAG_VBS = '[VBS]';

const LOG_MAX_FILE_SIZE = 1024 * 1024 * 10; // 10 MB
const LOG_MAX_BUF_SIZE = 1024 * 4 * 2;
const LOG_MAX_BLOCK_SIZE = 1024 * 6;

let is_open = false;
let process_tag;
let log_lvl = LOG_LVL_NONE;
let log_path;
let log_mode;
let log_write_stream;
let log_bf = Buffer.alloc(LOG_MAX_BUF_SIZE);
let log_bf_len = 0;
let log_total_written = 0;
let log_tag = "";

function get_time_stamp() {
    let day = new Date();
    let mon = day.getMonth() + 1;
    let s_mon = "";
    if (mon < 10) {
        s_mon = "0" + mon;
    } else {
        s_mon += mon;
    }
    let date = day.getDate();
    let s_date = "";
    if (date < 10) {
        s_date = "0" + date;
    }
    else {
        s_date += date;
    }
    let hour = day.getHours();
    let s_hour = "";
    if (hour < 10) {
        s_hour = "0" + hour;
    } else {
        s_hour += hour;
    }
    let min = day.getMinutes();
    let s_min = "";
    if (min < 10) {
        s_min = "0" + min;
    } else {
        s_min += min;
    }
    let sec = day.getSeconds();
    let s_sec = "";
    if (sec < 10) {
        s_sec = "0" + sec;
    } else {
        s_sec += sec;
    }
    let ms = day.getMilliseconds();
    let s_ms = "";
    if (ms < 10) {
        s_ms = "00" + ms;
    } else if (ms < 100) {
        s_ms = "0" + ms;
    } else {
        s_ms += ms;
    }

    var s = day.getFullYear() + "-" + s_mon + "-" + s_date + " " + s_hour + ":"
        + s_min + ":" + s_sec + "." + s_ms;
    return s;
}

function log_open(name, lvl, append) {
    log_lvl = lvl;
    log_mode = append;
    log_path = name;
    log_total_written = 0;
    if (log_lvl == LOG_LVL_NONE || !name || name === "") {
        return;
    }
    let f = 'a';
    if (!append)
    {
        f = 'w';
    }
    is_open = true;
    let option = {
        flags: f,           // 指定用什么模式打开文件，’w’代表写，’r’代表读，类似的还有’r+’、’w+’、’a’等
        encoding: 'utf8',   // 指定打开文件时使用编码格式，默认就是“utf8”，你还可以为它指定”ascii”或”base64”
        fd: null,           // fd属性默认为null，当你指定了这个属性时，createReadableStream会根据传入的fd创建一个流，忽略path。
                            // 另外你要是想读取一个文件的特定区域，可以配置start、end属性，指定起始和结束（包含在内）的字节偏移
        mode: 0664,
        autoClose: true     // autoClose属性为true（默认行为）时，当发生错误或文件读取结束时会自动关闭文件描述符
    };
    process_tag = '[' + process.pid + ']';
    log_write_stream = fs.createWriteStream(name, option);
    let head = "*********************************************************"
        + "\n * \t@platform: " + os.platform()
        + "\n * \t@arch: " + os.arch()
        + "\n * \t@pid: " + process.pid
        + "\n * \t@filename: " + name
        + "\n * \t@time: " + get_time_stamp()
        + "\n * \t@operation: open"
        + "\n*********************************************************\n";
    
    log_write_stream.write(head, 'utf8');
}

function log_close() {
    if (!is_open) {
        return;
    }
    if (log_bf_len > 0) {
        log_write_stream.write(log_bf.toString('utf8', 0, log_bf_len), 'utf8');
        log_bf_len = 0;
    }
    is_open = false;
    let tail = "*********************************************************\n"
        + " * \t@time: " + get_time_stamp()
        + "\n * \t@operation: close"
        + "\n*********************************************************\n";

    log_write_stream.write(tail, 'utf8');
    log_write_stream.end();
    log_write_stream.close();
}

function log_backup() {
    log_close();
    let bak_ts = get_time_stamp();
    bak_ts = bak_ts.replace(new RegExp(":", 'g'), "");
    bak_ts = bak_ts.replace(new RegExp("-", 'g'), "");
    bak_ts = bak_ts.replace(new RegExp(" ", 'g'), "");
    bak_ts = "bak_"+bak_ts;
    if (!fs.existsSync("backup"))
    {
        fs.mkdirSync("backup");
    }
    fs.renameSync(log_path, "backup/" + bak_ts + log_path);
    log_open(log_path, log_lvl, log_mode);
}

// 过长 backup
function stream_write_msg(msg) {
    let len = log_bf.write(msg, log_bf_len, 'utf8');
    log_total_written += len;
    log_bf_len += len;
    if (log_bf_len > LOG_MAX_BLOCK_SIZE) {
        log_write_stream.write(log_bf.toString('utf8', 0, log_bf_len), 'utf8');
        log_bf_len = 0;
    }
    if (log_total_written >= LOG_MAX_FILE_SIZE) {
        log_backup();
    }
}

exports.LogError = function (msg) {
    if (msg == null || msg == undefined || msg === "" || !is_open) {
        return;
    }
    if (log_lvl & LOG_LVL_ERROR) {
        log_tag = '[' + get_time_stamp() + ']' + process_tag + LOG_LVL_TAG_ERROR;
        stream_write_msg(log_tag + msg + '\n');
    }
}

exports.LogCrit = function (msg) {
    if (msg == null || msg == undefined || msg === "" || !is_open) {
        return;
    }
    if (log_lvl & LOG_LVL_CRIT) {
        log_tag = '[' + get_time_stamp() + ']' + process_tag + LOG_LVL_TAG_CRIT;
        stream_write_msg(log_tag + msg + '\n');
    }
}

exports.LogWarn = function (msg) {
    if (msg == null || msg == undefined || msg === "" || !is_open) {
        return;
    }
    if (log_lvl & LOG_LVL_WARN) {
        log_tag = '[' + get_time_stamp() + ']' + process_tag + LOG_LVL_TAG_WARN;
        stream_write_msg(log_tag + msg + '\n');
    }
}

exports.LogDbg = function (msg) {
    if (msg == null || msg == undefined || msg === "" || !is_open) {
        return;
    }
    if (log_lvl & LOG_LVL_DBG) {
        log_tag = '[' + get_time_stamp() + ']' + process_tag + LOG_LVL_TAG_DBG;
        stream_write_msg(log_tag + msg + '\n');
    }
}

exports.LogInfo = function (msg) {
    if (msg == null || msg == undefined || msg === "" || !is_open) {
        return;
    }
    if (log_lvl & LOG_LVL_INFO) {
        log_tag = '[' + get_time_stamp() + ']' + process_tag + LOG_LVL_TAG_INFO;
        stream_write_msg(log_tag + msg + '\n');
    }
}

exports.LogVbs = function (msg) {
    if (msg == null || msg == undefined || msg === "" || !is_open) {
        return;
    }
    if (log_lvl & LOG_LVL_VBS) {
        log_tag = '[' + get_time_stamp() + ']' + process_tag + LOG_LVL_TAG_VBS;
        stream_write_msg(log_tag + msg + '\n');
    }
}

exports.LogOpen = function (name = "default.log", lvl = LOG_LVL_LOW, append = true) {
    log_open(name, lvl, append);
}

exports.LogClose = function () {
    log_close();
}

exports.LoggerConfigInfo = function() {
    let info = ("Log file name : " + log_path);
    info += ("\nLog max size(in KB): " + LOG_MAX_FILE_SIZE / 1024);
    info += ("\nLog Level : ");
    info += ("\n    LOG_LVL_NONE: " + LOG_LVL_NONE + ", no any log at all;");
    info += ("\n    LOG_LVL_ALL: " + LOG_LVL_ALL + ", all levels log output;");
    info += ("\n    LOG_LVL_ERROR: " + LOG_LVL_ERROR + ", error log;");
    info += ("\n    LOG_LVL_CRIT: " + LOG_LVL_CRIT + ", critical log;");
    info += ("\n    LOG_LVL_WARN: " + LOG_LVL_WARN + ", warning log;");
    info += ("\n    LOG_LVL_DBG: " + LOG_LVL_DBG + ", debug log;");
    info += ("\n    LOG_LVL_INFO: " + LOG_LVL_INFO + ", info log;");
    info += ("\n    LOG_LVL_VBS: " + LOG_LVL_VBS + ", verbose log;");
    info += ("\n    LOG_LVL_LOW: " + LOG_LVL_LOW + ", low level(error, critical & warning) log;");
    info += ("\n    LOG_LVL_HIGH: " + LOG_LVL_HIGH + ", high level(error, critical, warning & debug) log!");
    info += ("\nLog current log level: " + log_lvl);
    info += ("\nLog current mode(append or not): " + log_mode);
    info += ("\nLog already written size: " + log_total_written);
    return info;
}

exports.LOG_LVL_NONE = LOG_LVL_NONE;
exports.LOG_LVL_ALL = LOG_LVL_ALL;
exports.LOG_LVL_LOW = LOG_LVL_LOW;
exports.LOG_LVL_HIGH = LOG_LVL_HIGH;
