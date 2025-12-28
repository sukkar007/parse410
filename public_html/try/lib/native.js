/*
使用例子
appFun(函数名字，传递的参数,function(data){
    data 为客户端返回的数据
})

或者没有传递参数的
appFun(函数名字，function(data){
    data 为客户端返回的数据
})

*/
(function() {
    var appid = 0;
    var native = {};
    var iosNeedMessageFun = [
        'buildRequest',
        'extractResponse',
        'getUid',
        'getTicket',
        'getArea',
        'getLanguage',
        'openChargePage',
    ];
    var iosGetMessageFun = {
        getTicket: 'ticket',
        getUid: 'uid',
        getArea: 'area',
        getLanguage: 'lang',
        openChargePage: 'openChargePage'
    };
    var androidNeedMessageFun = [
        'openChargePage',
    ];
    var system = (function() {
        var sysJuc = {
            ios: /(iPhone|iPad|iPod|iOS)/i,
            android: /(Android)/i
        };
        var nav = navigator.userAgent;
        return (sysJuc.ios.test(nav) ? 'ios' : sysJuc.android.test(nav) ? 'android' : 'other');
    })();

    function isFun(fun) {
        return Object.prototype.toString.call(fun) == '[object Function]';
    }

    function isJSONStr(str) {
        if (typeof str == 'string') {
            try {
                var obj = JSON.parse(str);
                if (typeof obj == 'object') {
                    return true;
                } else {
                    return false;
                }

            } catch (e) {
                return false;
            }
        } else {
            return false;
        }
    }
    window.shareInfo = function(data) {

    }

    window.appCallJs = function(data) {
        data = isJSONStr(data) ? JSON.parse(data) : data;
        native[data.id] && native[id](data.data);
        delete native[id];
    };
    window.getMessage = function(id, data) {
        // console.log('.......',id, data);
        data = isJSONStr(data) ? JSON.parse(data) : data;
        native[id] && native[id](data);
        delete native[id];
    };

    window.appFun = function() {
        var arg = arguments;
        // console.log("arguments",arguments);
        var funName = Array.prototype.shift.call(arg);
        var appObj = {};
        var callback = isFun(arg[0]) ? arg[0] : arg[1];
        isFun(arg[0]) ? arg[0] = undefined : '';
        try {
            if (system === 'ios') {
                appObj = window.webkit.messageHandlers;
                // console.log('appObj',appObj);
                if (iosNeedMessageFun.indexOf(funName) > -1) {
                    var key = appid;
                    key = iosGetMessageFun[funName] || key;
                    native[key] = function(data) {
                        callback && callback(data);
                    };
                    if (arg[0] !== undefined) {
                        var data = {
                            id: key,
                            data: {}
                        };
                        if (isJSONStr(arg[0])) {
                            data.data = JSON.parse(arg[0]);
                        } else {
                            data.data = arg[0];
                        }
                        arg[0] = JSON.stringify(data);
                        appObj[funName].postMessage(arg[0])
                    } else {
                        appObj[funName].postMessage(null);
                    };
                    appid++;
                } else {
                    if (arg[0] !== undefined) {
                        appObj[funName].postMessage(arg[0]);
                    } else {
                        appObj[funName].postMessage(null);
                    };
                }
            } else {
                // console.log(12);
                appObj = window.androidJsObj;
                // console.log('appObj',appObj);
                if (androidNeedMessageFun.indexOf(funName) > -1) {
                    var key = appid;
                    key = iosGetMessageFun[funName] || key;
                    native[key] = function(data) {
                        callback && callback(data);
                    };
                    if (arg[0] !== undefined) {
                        var data = {
                            id: key,
                            data: {}
                        };
                        if (isJSONStr(arg[0])) {
                            data = JSON.parse(arg[0]);
                        } else {
                            data = arg[0];
                        }
                        arg[0] = JSON.stringify(data);
                        // console.log(arg[0],data);
                        appObj[funName](arg[0]);
                    } else {
                        appObj[funName]();
                    };
                    appid++;
                } else {
                    if (arg[0] !== undefined) {
                        callback ? callback(appObj[funName](arg[0])) : appObj[funName](arg[0]);
                    } else {
                        callback ? callback(appObj[funName]()) : appObj[funName]();
                    };
                }
            }
        } catch (e) {
            console.log('错误', e);
        }
    };
})();