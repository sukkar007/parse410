  var count = 4;
    var rollCount = 1;
    var countTime = 10;
    var round = 0;

    var selectCount = 0;
    var selectArr = [];
    var countTimer = null;
    var handTimer = null;
    var rollTimer = null;
    var resultTimer = null;
    var timesWord = [5, 5, 10, 15, 25, 45, 5, 5];
    var goldList = [1, 10, 100, 1000, 10000];
    var resultCount = 5;
    var choiceList = ["g", "h", "a", "b", "c", "d", "e", "f"];
    var status = 0; // 0 可点击, 1 正在开奖, 2 已开奖
    var currentGold = 1;
    var openDrawTimer = null;

    console.log("User Info:", info);
    
var env = (function() {
    var ua = navigator.userAgent;
    var testProd = ['127.0.0.1', 'localhost', '47.119.22.2', 'beta.oohla.shijianline.cn'];
    var isProd = !testProd.some(function(item) {
        return window.location.host.indexOf(item) > -1
    });
    return {
        isProd, // 是否线上环境
        ios: !!ua.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/), //ios终端
        android: ua.indexOf('Android') > -1 || ua.indexOf('Adr') > -1, //android终端
        app: ua.indexOf('tiantianApp') > -1 || ua.indexOf('OohlaApp') > -1 //是否在app内
    };
})();

$(document).ready(function() {
    console.log("document ready");

    // تعيين uid و token مباشرة
    var uid = info.uid; 
    var token = info.token;

    if (env.app) {
        appFun("getUid", function(e) {
            info.uid = e || uid; // استخدام uid الثابت إذا لم يتم توفيره من التطبيق
            appFun("getToken", function(e) {
                info.token = e || token; // استخدام token الثابت إذا لم يتم توفيره من التطبيق
                appFun("getLanguage", function(e) {
                    info.lang = e || 'en'; // تعيين اللغة الافتراضية إذا لم يتم توفيرها
                    init();
                });
            });
        });
    } else {
        // تحديد القيم بناءً على بيئة العمل
        info = {
            uid: uid, // استخدام uid الثابت
            token: token, // استخدام token الثابت
            lang: 'en', // اللغة الافتراضية
        };
        init();
    }

    // إخفاء تعليمات iOS إذا لم يكن الجهاز iOS
    if (!env.ios) {
        $('#iosDesc').hide();
    }
});


// $(document).ready(function () {
//   info.uid = "10018";
//   info.token = "4b3c45cf598eb6526ec3f031e7b18598";
//   info.lang = "en";
//   init();
//   if (info.uid && info.uid == "95000103") {
//     eruda.init();
//     eruda.position({ y: 120, x: 120 });
//   }
// });

function init() {
    console.log("init enter");
    moment.tz.setDefault("Asia/Riyadh");
    changeLang(info.lang);
    showHand();
    bindEvent();
    getInfo();
    getBill();
    getRank();
}

function showHand() {
    count = 4;
    $(".hand").attr("class", "hand hand3");
    $(".hand").show();
    if (handTimer) {
        clearInterval(handTimer);
    }
    handTimer = setInterval(function() {
        if (count == 1) {
            $(".hand").removeClass("hand8");
        } else {
            $(".hand").removeClass("hand" + (count - 1));
        }

        $(".hand").addClass("hand" + count);
        count++;
        if (count > 8) {
            count = 1;
        }
    }, 1000);
}

function hideHand() {
    $(".hand").hide();
}

function showResult(result, topList, winGold, avatar) {
    $(".reword").show();
    if (winGold && winGold > 0) {
        $(".prize").show();
        $(".reword_word>div:first-child>div:last-child")[0].innerHTML = winGold;
        console.log(avatar);
        $(".prize .self img").attr("src", avatar);
        $(".reword_word>div img:last-child").attr(
            "src",
            "images/gift_" + searchGift(result) + ".png"
        );
    } else {
        $(".noPrize").show();
        $(".noPrize>div img:last-child").attr(
            "src",
            "images/gift_" + searchGift(result) + ".png"
        );
    }
    if (info.lang == "ar") {
        $(".reword .roundWord").html("طلقة" + (round - 1) + " نتيجة");
    } else {
        $(".reword .roundWord").html("The result of " + (round - 1) + " round：");
    }
    var innerHTML = "";
    for (var i = 0; i < topList.length; i++) {
        innerHTML +=
            '<div class="personItem"><div class="logoArea"><div class="logo"><img src="' +
            topList[i].avatar +
            '" alt=""></div> <img class="no' +
            (i + 1) +
            '" src="images/no' +
            (i + 1) +
            '.png" alt=""></div><div class="nick">' +
            topList[i].nick +
            '</div><div class="flex ac jc"><img src="images/gold.png" alt=""><div>' +
            topList[i].total +
            "</div></div></div>";
    }
    for (var i = 0; i < 3 - topList.length; i++) {
        innerHTML +=
            '<div class="personItem"><div class="logoArea"><div class="logo"><img src="" alt=""></div></div><div class="nick"></div><div class="flex ac jc"></div></div>';
    }
    $(".reword_person").html(innerHTML);
    resultTimer = setInterval(function() {
        resultCount--;
        if (resultCount < 0) {
            resultCount = 5;
            clearInterval(resultTimer);
            $(".reword").hide();
            $(".prize").hide();
            $(".noPrize").hide();
        }
        $(".reword .reword_content .countDown")[0].innerHTML = resultCount + "s";
    }, 1000);
}

function countDown() {
    // countTime--;
    // $('.coutDown')[0].innerHTML = countTime + 's'
    if (countTimer) {
        clearInterval(countTimer);
    }
    countTimer = setInterval(function() {
        countTime--;
        if (countTime <= 0) {
            countTime = 0;
            status = 1;
            roll();
            clearInterval(countTimer);
        }
        $(".coutDown")[0].innerHTML = countTime + "s";
    }, 1000);
}

function openDraw() {
    getInfo(round);
}
function sureClick(choice, index) {
    // تعيين القيم الثابتة مباشرة
   
    // الخصم المبدئي للرصيد في الواجهة
    let currentBalance = parseFloat($('.balanceCount').text());
    if (currentBalance < currentGold) {
        showSuccess("Insufficient balance! Please recharge.");
        return;
    }

    // تحديث الرصيد مؤقتًا
    $('.balanceCount').text((currentBalance - currentGold).toFixed(2));


    // إرسال الطلب إلى الخادم
    $.ajax({
        url: "/appapi/Frot/choice", // رابط API الخلفية
        data: {
            uid: info.uid, // UID من PHP
            token: info.token, // Token من PHP
            choice: choice,
            gold: currentGold,
            round: round,
            language: info.lang,
            _t: new Date().getTime(),
        },
        method: "POST",
        success: function(res) {
            console.log(res);
            if (res.code == 200) {
                // تحديث البيانات بناءً على الاستجابة
                selectCount += 1;
                if (!selectArr.includes(choice)) {
                    selectArr.push(choice);
                }

                // تحديث واجهة المستخدم
                var list = [6, 7, 8, 1, 2, 3, 4, 5];
                var temp = $(`.item${list[index]} .selected div:nth-child(2) div`)[0].innerHTML;

                $(`.item${list[index]} .selected div:nth-child(2) div`)[0].innerHTML = 
                    parseInt(temp) + parseInt(currentGold);
                $(`.item${list[index]} .selected`).show();

                // تحديث الرصيد في الواجهة
                $('#balance').text(res.balance);
            } else if (res.code == 10062) {
                showSuccess("Please recharge");
            } else {
                showSuccess(res.message);
            }
        },
        error: function() {
            showSuccess("System Error");
        },
    });
}

function roll(dir) {
    hideHand();
    selectCount = 0;
    selectArr = [];
    $(".title1").hide();
    // $('.coutDown').hide();
    $(".title2").show();
    $(".coutDown")[0].innerHTML = countTime + "s";
    var countTimer = setInterval(function() {
        countTime--;
        if (countTime <= 0) {
            countTime = 0;
            status = 0;
            clearInterval(countTimer);
            clearInterval(rollTimer);
            for (var i = 0; i < $(".item .gray").length; i++) {
                $($(".item .gray")[i]).hide();
            }
            openDraw();
        }
        $(".coutDown")[0].innerHTML = countTime + "s";
    }, 1000);
    for (var i = 0; i < $(".item .gray").length; i++) {
        $(".item" + (i + 1) + " .selected div:nth-child(2) div")[0].innerHTML = 0;
        $(".item" + (i + 1) + " .selected").hide();
        $(".item" + (i + 1)).removeClass("active");
        $($(".item .gray")[i]).show();
    }
    $($(".item .gray")[rollCount]).hide();
    rollTimer = setInterval(function() {
        for (var i = 0; i < $(".item .gray").length; i++) {
            $($(".item .gray")[i]).show();
        }
        rollCount++;
        if (rollCount > 7) {
            rollCount = 0;
        }
        $($(".item .gray")[rollCount]).hide();
    }, 100);
    countTime = 10;
    // openDrawTimer = setTimeout(function () {
    //     clearInterval(rollTimer);
    //     for (var i = 0; i < $('.item .gray').length; i++) {
    //         $($('.item .gray')[i]).hide()
    //     }
    //     openDraw();
    // }, 10000)
}
var hideLock = false;

function bindEvent() {
    $(".clickArea .clickItem").click(function() {
        for (var i = 0; i < $(".clickItem").length; i++) {
            $($(".clickItem").removeClass("active"));
        }
        $(this).addClass("active");
        currentGold = goldList[$(this).data("index")];
        console.log(currentGold);
    });
    try {
        document.addEventListener("visibilitychange", function() {
            if (document.hidden) {
                // 页面被挂起
                hideLock = true;
                sessionStorage.setItem("currentRound", round);
                if (countTimer) {
                    clearInterval(countTimer);
                }
            } else {
                if (hideLock) {
                    hideLock = false;
                    getInfo();
                }
                // 页面呼出
            }
        });
    } catch (error) {}

    $("body").click(function() {
        console.log(111);
        appFun("closeWin", function() {});
    });

    $(".content").click(function(e) {
        e.stopPropagation();
    });

    $(".item").click(function() {
        console.log($(this).data("index"));
        if (status == 0) {
            for (var i = 0; i < $(".item").length; i++) {
                $(".item" + (i + 1)).removeClass("active");
            }
            console.log("selectCountselectCount", selectCount);
            // if (selectCount > 5) {
            //     showSuccess('Max Selected')
            //     return
            // }
            var isHas = false;
            for (var i = 0; i < selectArr.length; i++) {
                if (selectArr[i] == choiceList[$(this).data("index")]) {
                    isHas = true;
                }
            }
            if (selectArr.length > 5 && !isHas) {
                showSuccess("Max Selected");
                return;
            }

            sureClick(choiceList[$(this).data("index")], $(this).data("index"));
        }
    });
    $(".records").click(function() {
        getBill();
        $(".recordsBg").show();
    });
    $(".recordsBg .modalBack").click(function() {
        $(".recordsBg").hide();
    });

    $(".rule").click(function() {
        $(".ruleBg").show();
    });
    $(".ruleBg").click(function() {
        $(".ruleBg").hide();
    });

    $(".rank").click(function() {
        getRank();
        $(".rankBg").show();
    });
    $(".rankBg .modalBack").click(function() {
        $(".rankBg").hide();
    });
    $(".reword").click(function(e) {
        e.stopPropagation();
    });

    // $('.rewordBtn').click(function (e) {
    //     getRewradTop()
    //     $('.rewardBg').show()
    // })

    $(".rewardBg .modalBack").click(function() {
        $(".rewardBg").hide();
    });

    $(".rewordNo").click(function(e) {
        e.stopPropagation();
    });
    $(".pop-success").click(function(e) {
        e.stopPropagation();
    });
}function getRewradTop() {
    // تعيين القيم الثابتة مباشرة
  

    $.ajax({
        url: "/appapi/Frot/yesterday", // رابط API الخلفية
        data: {
           uid: info.uid,
        token: info.token,
            _t: new Date().getTime(), // منع الكاش
            language: info.lang, // اللغة الحالية
            
        },
        method: "POST",
        success: function(res) {
            if (res.code === 200) {
                if (res.data && res.data.top3List && res.data.top3List.length) {
                    var top3List = res.data.top3List;
                    var tempHtml = "";
                    for (var i = 0; i < top3List.length; i++) {
                        tempHtml +=
                            '<div class="_top' +
                            (i + 1) +
                            " top" +
                            (i + 1) +
                            '"><div class="topLogo"><div class="logo"><img src="' +
                            top3List[i].avatar +
                            '" alt=""></div><img src="images/top' +
                            (i + 1) +
                            '.png" alt=""></div><div class="nick">' +
                            top3List[i].nick +
                            "</div></div>";
                    }
                    $(".rewardTop3").html(tempHtml);
                }
            } else {
                console.error("Error in response:", res.message);
            }
        },
        error: function(xhr, status, error) {
            console.error("AJAX request failed:", error);
        },
    });
}
function getRank() {
    // تعيين القيم الثابتة مباشر
    $.ajax({
        url: "/appapi/Frot/rank", // رابط API الخلفية
        data: {
            uid: info.uid,
        token: info.token,
            _t: new Date().getTime(), // منع الكاش
           
            language: info.lang, // اللغة الحالية
        },
        method: "POST",
        success: function(res) {
            if (res.code === 200) {
                var innerHTML = "";
                var topHTML = "";

                if (res.data && res.data.length) {
                    // عرض أفضل 3 مستخدمين
                    for (var i = 0; i < Math.min(3, res.data.length); i++) {
                        var top = res.data[i];
                        topHTML +=
                            '<div class="top' +
                            (i + 1) +
                            '"><div class="topLogo"><div class="logo"><img src="' +
                            top.avatar +
                            '" alt=""></div><img src="images/top' +
                            (i + 1) +
                            '.png" alt=""></div><div class="nick">' +
                            top.nick +
                            '</div><div class="price flex ac jc"><img src="images/gold.png" alt=""><div>' +
                            top.total +
                            '</div></div></div>';
                    }

                    // عرض باقي المستخدمين (الترتيب من 4 فما فوق)
                    for (var i = 3; i < res.data.length; i++) {
                        var tempItem = res.data[i];
                        innerHTML +=
                            '<div class="topItem flex ac"><div class="rankCount">' +
                            (i + 1) +
                            '</div><div class="head"><img src="' +
                            tempItem.avatar +
                            '" alt=""></div><div class="name">' +
                            tempItem.nick +
                            '</div><div class="score flex ac"><div class="scoreRank">' +
                            tempItem.total +
                            '</div><img src="images/gold.png" alt=""></div></div>';
                    }

                    $(".topThree").html(topHTML);
                    $(".topList").html(innerHTML);
                }
            } else {
                console.error("Error in response:", res.message);
            }
        },
        error: function(xhr, status, error) {
            console.error("Error in AJAX request:", error);
        },
    });
}
function getInfo(_round, isChoice) {

    var data = {
         uid: info.uid, // UID من PHP
            token: info.token, // Token من PHP
        _t: new Date().getTime(),
        language: info.lang,
    };
    if (_round) {
        data.round = _round;
    }
    console.log("getInfo enter");
    $.ajax({
        url: "/appapi/Frot/info", // رابط API الخلفية
        data: data,
        success: function(res) {
            console.log(res);
            if (res.code === 200) {
               if (res.data) {
                    if (res.data.countdown && res.data.countdown < 0) {
                        showSuccess("System Error, connetting...");

                        if (countTimer) {
                            clearInterval(countTimer);
                        }
                        if (handTimer) {
                            clearInterval(handTimer);
                        }
                        if (rollTimer) {
                            clearInterval(rollTimer);
                        }
                        if (resultTimer) {
                            clearInterval(resultTimer);
                        }

                        setTimeout(function() {
                            getInfo();
                            showHand();
                        }, 800);
                        return;
                    }

                    $(".balanceCount")[0].innerHTML = res.data.gold.toFixed(2);
                    $(".profitCount")[0].innerHTML = res.data.profit;
                    $(".round")[0].innerHTML = "Round " + res.data.round;

                    // 还在抽奖中，不改变以下的值，如果round改变了，就拿不到中奖结果
                    if (status == 1 && isChoice) return;
                    round = res.data.round;
                    // status = 0;

                    // 下注不重新设置倒计时
                    if (!isChoice) {
                        countTime = res.data.countdown;
                        $(".coutDown")[0].innerHTML = countTime + "s";

                        if (countTimer) {
                            clearInterval(countTimer);
                        }
                        countDown();
                    }

                    $(".title2").hide();
                    $(".title1").show();
                    // $('.coutDown').show();

                    // 本轮中奖结果设置
                    if (res.data.result && res.data.result != "") {
                        // 设置
                        $(".item" + searchGift(res.data.result)).addClass("active");
                        $(".noPrize1>div img:last-child").attr(
                            "src",
                            "images/gift_" + searchGift(res.data.result) + ".png"
                        );
                    }

                    // 结果记录列表
                    var giftListHtml = "";
                    res.data.resultList = res.data.resultList.reverse();
                    for (var i = 0; i < res.data.resultList.length; i++) {
                        var _index = searchGift(res.data.resultList[i]);
                        if (i == 0) {
                            giftListHtml +=
                                '<div class="giftItem"><img src="images/gift_' +
                                _index +
                                '.png" alt=""><img src="images/new.png" alt=""></div>';
                        } else {
                            giftListHtml +=
                                '<div class="giftItem"><img src="images/gift_' +
                                _index +
                                '.png" alt=""></div>';
                        }
                    }

                    $(".giftList").html(giftListHtml);

                    if (_round) {
                        clearInterval(handTimer);
                        showHand();
                    }

                    // 显示用户已选的食物以及金额
                    if (res.data.select && Object.keys(res.data.select).length) {
                        var ak = Object.keys(res.data.select);
                        var vk = Object.values(res.data.select);
                        for (var i = 0; i < ak.length; i++) {
                            var temp = $(
                                ".item" + searchGift(ak[i]) + " .selected div:nth-child(2) div"
                            )[0].innerHTML;

                            $(
                                ".item" + searchGift(ak[i]) + " .selected div:nth-child(2) div"
                            )[0].innerHTML = vk[i];
                            $(".item" + searchGift(ak[i]) + " .selected").show();
                        }
                    } else {
                        for (var i = 0; i < $(".item .gray").length; i++) {
                            $(
                                ".item" + (i + 1) + " .selected div:nth-child(2) div"
                            )[0].innerHTML = 0;
                            $(".item" + (i + 1) + " .selected").hide();
                        }
                    }

                    // 公布结果
                    if (_round && res.data.top && res.data.top.length) {
                        // if(res.data.top && res.data.top.length) {
                        // 公布结果
                        showResult(
                            res.data.result,
                            res.data.top,
                            res.data.winGold,
                            res.data.avatar
                        );
                    } else if (_round) {
                        if (info.lang == "ar") {
                            $(".rewordNo .roundWord").html("طلقة" + (round - 1) + " نتيجة");
                        } else {
                            $(".rewordNo .roundWord").html(
                                "The result of " + (round - 1) + " round："
                            );
                        }

                        resultTimer = setInterval(function() {
                            resultCount--;
                            if (resultCount < 0) {
                                resultCount = 5;
                                clearInterval(resultTimer);
                                $(".rewordNo").hide();
                            }
                            $(".rewordNo .reword_content .countDown")[0].innerHTML =
                                resultCount + "s";
                        }, 1000);
                        $(".rewordNo").show();
                    }
                } else {
                    showSuccess("System Error");
                }
            } else {
                // showSuccess(res.message)
            }
        },
    });
}


function searchGift(value) {
    var temp = 0;
    for (var i = 0; i < choiceList.length; i++) {
        if (value == choiceList[i]) {
            temp = i;
            break;
        }
    }

    var list = [6, 7, 8, 1, 2, 3, 4, 5];

    return list[temp];
}
function getBill() {
    $.ajax({
        url: allUrl() + "/appapi/Frot/bill",
        data: {
            uid: info.uid,
            _t: new Date().getTime(),
            token: info.token,
            language: info.lang,
        },
        success: function(res) {
            console.log(res);
            if (res.code == 200 && res.data) {
                var innerHTML = "";
                var list = [6, 7, 8, 1, 2, 3, 4, 5];
                for (var i = 0; i < res.data.length; i++) {
                    var tempItem = res.data[i];
                    var isWin = tempItem.choice == tempItem.result;
                    innerHTML +=
                        '<div class="records-list-item flex ac js"><div class="inner-item">' +
                        tempItem.gold +
                        ' gold</div><div class="inner-item"> <img src="images/gift_' +
                        searchGift(tempItem.choice) +
                        '.png" alt=""> </div><div class="inner-item"><img src="images/gift_' +
                        searchGift(tempItem.result) +
                        '.png" alt=""></div><div class="inner-item"><div>' +
                        changeWord(isWin) +
                        "</div>" +
                        (isWin ?
                            "<div>(" +
                            timesWord[searchGift(tempItem.result) - 1] +
                            changeTimesWord() +
                            ")</div>" :
                            "") +
                        '</div><div class="inner-item"><div>' +
                        moment(tempItem.createTime).format("YYYY/MM/DD") +
                        "</div><div>" +
                        moment(tempItem.createTime).format("HH:mm:ss") +
                        "</div></div></div>";
                }
                $(".records-list").html(innerHTML);
            }
        },
    });
}

function changeTimesWord() {
    if (info.lang == "ar") {
        return "مرات";
    } else {
        return "times";
    }
}

function changeWord(win) {
    if (info.lang == "ar") {
        if (win) {
            return "لا";
        } else {
            return "نعم";
        }
    } else {
        if (win) {
            return "Yes";
        } else {
            return "No";
        }
    }
}

function getResult() {
  
    $.ajax({
        url: "/appapi/Frot/getResult",
        method: "POST",
        data: {
            uid: info.uid, // UID من PHP
            token: info.token, // Token من PHP
        },
        success: function(res) {
            console.log(res);
            if (res.code === 200) {
                // عرض النتيجة والفائزين
                console.log("Round:", res.data.round);
                console.log("Result:", res.data.result);
                console.log("Winners:", res.data.winners);
            } else {
                console.error(res.message);
            }
        },
        error: function(err) {
            console.error("Error fetching result:", err);
        }
    });
}


function showSuccess(msg, fn) {
    $(".pop-success div")[0].innerHTML = msg;
    $(".pop-success").show();
    setTimeout(function() {
        $(".pop-success div")[0].innerHTML = "";
        if (fn) {
            fn();
        }
        $(".pop-success").hide();
    }, 1500);
}

function changeLang(defaultLang) {
    if ('en,ar,in,yn'.indexOf(defaultLang) === -1 || !defaultLang) {
        defaultLang = 'en';
    }

    function languageSelect(defaultLang) {
        $("[i18n]").i18n({
            defaultLang: defaultLang,
            filePath: "js/i18n/",
            filePrefix: "i18n_",
            fileSuffix: "",
            forever: true,
            callback: function(res) {},
        });
    }
    if (info.lang == "ar") {
        $(".records").attr("src", "images/btn_records@2x.png");
        $(".rule").attr("src", "images/btn_rule@2x.png");
        $(".rank").attr("src", "images/btn_rank@2x.png");
    }

    languageSelect(defaultLang);
}