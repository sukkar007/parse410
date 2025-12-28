function checkVersion() {
    var u = navigator.userAgent,
        app = navigator.appVersion;
    return {
        trident: u.indexOf('Trident') > -1, //IE内核
        presto: u.indexOf('Presto') > -1, //opera内核
        webKit: u.indexOf('AppleWebKit') > -1, //苹果、谷歌内核
        gecko: u.indexOf('Gecko') > -1 && u.indexOf('KHTML') == -1, //火狐内核
        mobile: !!u.match(/AppleWebKit.*Mobile.*/), //是否为移动终端
        ios: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/), //ios终端
        android: u.indexOf('Android') > -1 || u.indexOf('Adr') > -1, //android终端
        iPhone: u.indexOf('iPhone') > -1, //是否为iPhone或者QQHD浏览器
        iPad: u.indexOf('iPad') > -1, //是否iPad
        webApp: u.indexOf('Safari') == -1, //是否web应该程序，没有头部与底部
        weixin: u.indexOf('MicroMessenger') > -1, //是否微信
        qq: u.match(/\sQQ/i) == " qq", //是否QQ
        app: u.indexOf('tiantianApp') > -1 //是否在app内
    };
}

//根据语言判断索引
function langFun() {
    var num = 0;
    if (info.lang == 'ar') {
        num = 1;
    } else if (info.lang == 'zh') {
        num = 0;
    } else {
        num = 2;
    }
    return num;
}

7

function _copyToClipboard(content, callback) {
    var textarea = document.createElement("textarea");
    textarea.style.position = "absolute";
    textarea.style.left = "-1000px";
    textarea.style.top = "-1000px";
    textarea.value = content;
    textarea.readOnly = true;
    document.body.appendChild(textarea);

    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    var result = false;
    try {
        result = document.execCommand("copy");
        callback && callback();
    } catch (e) {}
    document.body.removeChild(textarea);
    textarea = null;
    return result;
}

var refreshWeb = function refreshWeb() {
    location.reload();
    return "";
};


function isObj(obj) {
    return Object.prototype.toString.call(obj) == '[object Object]';
}

function isFun(fun) {
    return Object.prototype.toString.call(fun) == '[object Function]';
}

function isArr(arr) {
    return Object.prototype.toString.call(arr) == '[object Array]';
}

function isNum(num) {
    return Object.prototype.toString.call(num) == '[object Number]';
}

/**
 * 
 * @param {*} obj 
 * obj.id 模板id
 * obj.data 模板数据
 * obj.dom 需要添加模板的目标dom (zepto或jquery对象)
 */
function artTemplate(obj) {
    var html = template(obj.id, obj.data);
    obj.dom.append(html);
}



/**
 * 
 * @param {*} e 参数
 * @param {*} type 对象
 * @param {*} fn 回调函数 每秒返回一次
 * key 为 时间类型  键值为 赋值的jq dom 对象
 * days
 * hours
 * minutes
 * second
 * 时间为零返回00
 */
function timer(e, obj, fn) {

    var time_ = Number(e);
    var obj_ = {};
    if (fn) {
        var flag = false;
    }
    if (time_ <= 0) {
        return "00"
    } else {
        if (obj['days'] && obj['days'].length) {
            let day_ = parseInt(time_ / 1000 / 60 / 60 / 24) >= 10 ? parseInt(time_ / 1000 / 60 / 60 / 24) : (parseInt(time_ / 1000 / 60 / 60 / 24) > 0 ? '0' + parseInt(time_ / 1000 / 60 / 60 / 24) : '00');
            if (obj['days'].html() == day_) {

            } else {
                obj['days'].html(day_);
            }
            obj_.days = day_;
        }
        if (obj['hours'] && obj['hours'].length) {
            let hours_ = parseInt((time_ / 1000 / 60 / 60) % 24) >= 10 ? parseInt((time_ / 1000 / 60 / 60) % 24) : (parseInt((time_ / 1000 / 60 / 60) % 24) > 0 ? '0' + parseInt((time_ / 1000 / 60 / 60) % 24) : '00');
            if (obj['hours'].html() == hours_) {

            } else {
                obj['hours'].html(hours_);
            }
            obj_.hours = hours_;
        }
        if (obj['minutes'] && obj['minutes'].length) {
            let minutes_ = parseInt((time_ / 1000 / 60) % 60) >= 10 ? parseInt((time_ / 1000 / 60) % 60) : (parseInt((time_ / 1000 / 60) % 60) > 0 ? '0' + parseInt((time_ / 1000 / 60) % 60) : '00');
            if (obj['minutes'].html() == minutes_) {

            } else {
                obj['minutes'].html(minutes_);
            }
            obj_.minutes = minutes_;
        }
        if (obj['seconds'] && obj['seconds'].length) {
            let second_ = parseInt(time_ / 1000 % 60) >= 10 ? parseInt(time_ / 1000 % 60) : (parseInt(time_ / 1000 % 60) > 0 ? '0' + parseInt(time_ / 1000 % 60) : '00');
            if (obj['seconds'].html() == second_) {

            } else {
                obj['seconds'].html(second_);
            }
            obj_.second = second_;
        }
    }
    setTimeout(function() {
        e = e - 1000;
        timer(e, obj, fn);
        return isFun(fn) && fn(obj_);
    }, 1000);
}
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ?
    function(obj) {
        return typeof obj;
    } :
    function(obj) {
        return obj &&
            typeof Symbol === "function" &&
            obj.constructor === Symbol &&
            obj !== Symbol.prototype ?
            "symbol" :
            typeof obj;
    };

var browser = checkVersion()

function openPersonPage(params) {
    if (!params) return;
    if (browser.ios && window.webkit) {
        window.webkit.messageHandlers.openPersonPage.postMessage(params);
    } else if (browser.android) {
        if (androidJsObj && (typeof androidJsObj === 'undefined' ? 'undefined' : _typeof(androidJsObj)) === 'object') {
            window.androidJsObj.openPersonPage(params);
        }
    }
};

function openChargePage(params) {
    // if (!params) return;
    if (browser.ios && window.webkit) {
        window.webkit.messageHandlers.openChargePage.postMessage(params);
    } else if (browser.android) {
        if (androidJsObj && (typeof androidJsObj === 'undefined' ? 'undefined' : _typeof(androidJsObj)) === 'object') {
            window.androidJsObj.openChargePage();
        }
    }
};
//去首页；
function openHomePage() {
    if (browser.ios && window.webkit) {
        window.webkit.messageHandlers.openHomePage.postMessage();
    } else if (browser.android) {
        if (androidJsObj && (typeof androidJsObj === 'undefined' ? 'undefined' : _typeof(androidJsObj)) === 'object') {
            window.androidJsObj.openHomePage();
        }
    }
}

function parseQueryString(url) {
    var _url = location.search;
    var theRequest = new Object();
    if (_url.indexOf('?') != -1) {
        var str = _url.substr(1);
        strs = str.split('&');
        for (var i in strs) {
            theRequest[strs[i].split('=')[0]] = decodeURI(strs[i].split('=')[1]);
        }
    }
    return theRequest;
}

function openRoom(params) {
    console.log(1212);
    if (browser.ios && window.webkit) {
        console.log(2121)
        window.webkit.messageHandlers.openRoom.postMessage(params);
    } else if (browser.android) {
        console.log(1221, params)
        if (androidJsObj && (typeof androidJsObj === 'undefined' ? 'undefined' : _typeof(androidJsObj)) === 'object') {
            window.androidJsObj.openRoom(params);
        }
    }
}

function allUrl() {
    if (location.protocol === 'https:') {
        if (location.origin === 'https://flamingochat.net') {
            return 'https://flamingochat.net'
        } else {
            return 'https://flamingochat.net'
        }
    } else {
        return 'https://flamingochat.net'
    }
}