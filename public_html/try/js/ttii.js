/**
 * لعبة عجلة الفواكه - نسخة محسّنة نهائية شاملة
 * الاتصال الآمن مع Parse Cloud Functions عبر Flutter WebView
 * 
 * الإصلاحات الشاملة:
 * 1. إصلاح عرض صورة المستخدم عند إعلان النتيجة
 * 2. إصلاح تسجيل آخر فاكهة رابحة في الشريط
 * 3. إصلاح استخراج الصور من JSON و URL المباشر
 * 4. إصلاح عرض صور الفائزين
 * 5. إصلاح مشكلة ظهور الفائز مرتين
 */

// معلومات اللاعب - سيتم حقنها من Flutter
var info = window.flamingoPlayerInfo || {
    uid: '',
    username: '',
    nickname: '',
    avatar: '',
    credits: 0,
    diamonds: 0,
    lang: 'en'
};

// إعدادات اللعبة
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
var status = 0;
var currentGold = 1;
var hideLock = false;

// خريطة الفواكه
var fruitMap = {
    'g': 6,
    'h': 7,
    'a': 8,
    'b': 1,
    'c': 2,
    'd': 3,
    'e': 4,
    'f': 5
};

// تخزين callbacks للطلبات المعلقة
var pendingRequests = {};
var requestIdCounter = 0;

// متغير لتخزين آخر فاكهة رابحة
var lastWinningFruit = null;

console.log("Player Info received from Flutter:", info);

if (window.flamingoPlayerInfo) {
    console.log("Player info received on load:", info);
    init();
}

window.onFlamingoPlayerInfo = function(playerInfo) {
    info = playerInfo;
    console.log("Player info updated:", info);
    
    if ($('.balanceCount').length > 0) {
        $('.balanceCount').text(formatNumber(parseFloat(info.credits).toFixed(2)));
    }
};

window.onFlamingoResponse = function(response) {
    console.log("Received response from Flutter:", response);
    
    var requestId = response.requestId;
    if (requestId && pendingRequests[requestId]) {
        var callback = pendingRequests[requestId];
        delete pendingRequests[requestId];
        
        if (response.success) {
            callback.resolve(response.data);
        } else {
            callback.reject(response.error || 'Unknown error');
        }
    }
};

$(document).ready(function() {
    console.log("Document ready - Flutter WebView Version");
    
    if (window.flamingoPlayerInfo) {
        init();
    } else {
        setTimeout(function() {
            if (window.flamingoPlayerInfo) {
                init();
            } else {
                showMessage("Waiting for player info...");
            }
        }, 1000);
    }
});

function init() {
    console.log("Initializing game...");
    if (typeof moment !== 'undefined') {
        moment.tz.setDefault("Asia/Riyadh");
    }
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

/**
 * دالة محسّنة لاستخراج صور المستخدمين
 * تدعم: URL مباشر، JSON object، JSON string، Parse File object
 */
function extractImageUrl(avatarData) {
    console.log("🔍 extractImageUrl input:", avatarData, "type:", typeof avatarData);
    
    if (!avatarData) {
        console.log("❌ No avatar data provided");
        return 'images/default_avatar.png';
    }
    
    // إذا كان URL مباشر (الحالة الأساسية من الخادم)
    if (typeof avatarData === 'string') {
        // URL مباشر
        if (avatarData.startsWith('http://') || avatarData.startsWith('https://')) {
            console.log("✅ Direct URL found:", avatarData);
            return avatarData;
        }
        
        // محاولة تحليل كـ JSON
        if (avatarData.includes('{') && avatarData.includes('}')) {
            try {
                var parsed = JSON.parse(avatarData);
                console.log("✅ Parsed JSON:", parsed);
                
                if (parsed && parsed.url) {
                    console.log("✅ URL extracted from JSON:", parsed.url);
                    return parsed.url;
                }
            } catch (e) {
                console.log("⚠️ Failed to parse JSON:", e.message);
            }
        }
        
        // إذا كان مجرد اسم ملف
        if (avatarData && avatarData.length > 0) {
            console.log("✅ Treating as filename:", avatarData);
            return 'images/' + avatarData;
        }
    }
    
    // إذا كان object
    if (typeof avatarData === 'object' && avatarData !== null) {
        console.log("✅ Object detected:", avatarData);
        
        if (avatarData.url) {
            console.log("✅ URL found in object:", avatarData.url);
            return avatarData.url;
        }
        
        // محاولة تحويل إلى string ثم تحليل
        try {
            var stringified = JSON.stringify(avatarData);
            var reparsed = JSON.parse(stringified);
            if (reparsed && reparsed.url) {
                console.log("✅ URL found after re-parsing:", reparsed.url);
                return reparsed.url;
            }
        } catch (e) {
            console.log("⚠️ Failed to re-parse object");
        }
    }
    
    console.log("❌ No valid URL found, using default");
    return 'images/default_avatar.png';
}

function showResult(result, topList, winGold, avatar) {
    console.log("🎉 ===== عرض النتيجة ===== 🎉");
    console.log("الفاكهة الفائزة:", result);
    console.log("قائمة الفائزين (أول 3):", topList);
    console.log("مكسب المستخدم الحالي:", winGold);
    console.log("صورة المستخدم الحالي (avatar):", avatar);
    
    // حفظ آخر فاكهة رابحة
    lastWinningFruit = result;
    
    // إخفاء كل شيء أولاً
    $(".reword, .prize, .noPrize").hide();
    
    var fruitNumber = searchGift(result);
    console.log("رقم الفاكهة الفائزة:", fruitNumber);
    
    // إذا كان هناك فائزون (topList)
    if (topList && topList.length > 0) {
        console.log("👑 هناك فائزون، عرض قائمة الفائزين 👑");
        
        $(".reword").show();
        $(".prize").show();
        $(".noPrize").hide();
        
        // عرض صورة الفاكهة الفائزة
        var fruitImg = $(".reword_word>div img:last-child")[0];
        if (fruitImg) {
            var fruitImagePath = getGiftImagePath(fruitNumber);
            fruitImg.src = fruitImagePath;
            console.log("✅ صورة الفاكهة الفائزة:", fruitImagePath);
        }
        
        // عرض نص الجولة
        if (info.lang == "ar") {
            $(".reword .roundWord").html("جولة " + (round - 1) + " النتيجة");
        } else {
            $(".reword .roundWord").html("The result of " + (round - 1) + " round:");
        }
        
        // بناء HTML للفائزين الثلاثة الأوائل - مع تجنب التكرار
        var topHTML = "";
        var processedWinners = [];
        
        for (var i = 0; i < Math.min(topList.length, 3); i++) {
            var winner = topList[i];
            
            // تجنب التكرار
            var winnerKey = winner.uid || winner.userId || winner.objectId || winner.nick;
            if (processedWinners.indexOf(winnerKey) !== -1) {
                console.log(`⚠️ تخطي الفائز المكرر: ${winnerKey}`);
                continue;
            }
            processedWinners.push(winnerKey);
            
            console.log(`الفائز ${i + 1}:`, winner);
            
            var winnerAvatar = extractImageUrl(winner.avatar);
            var winnerName = winner.nick || winner.username || `الفائز ${i + 1}`;
            var winnerPrize = winner.total || winner.winGold || 0;
            
            console.log(`✅ الفائز ${i + 1} - الاسم: ${winnerName}, الصورة: ${winnerAvatar}`);
            
            topHTML += `
                <div class="personItem">
                    <div class="logoArea">
                        <div class="logo">
                            <img src="${winnerAvatar}" 
                                 alt="${winnerName}" 
                                 onerror="this.src='images/default_avatar.png'"
                                 style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <img class="no${i + 1}" src="images/no${i + 1}.png" alt="المركز ${i + 1}">
                    </div>
                    <div class="nick">${winnerName}</div>
                    <div class="flex ac jc">
                        <img src="images/gold.png" alt="ذهب">
                        <div>${formatNumber(winnerPrize)}</div>
                    </div>
                </div>
            `;
        }
        
        // إذا كان هناك أقل من 3 فائزين، أضف أماكن فارغة
        for (var i = processedWinners.length; i < 3; i++) {
            topHTML += `
                <div class="personItem">
                    <div class="logoArea">
                        <div class="logo">
                            <img src="images/default_avatar.png" alt="لا يوجد" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    </div>
                    <div class="nick">---</div>
                    <div class="flex ac jc">
                        <img src="images/gold.png" alt="ذهب">
                        <div>0</div>
                    </div>
                </div>
            `;
        }
        
        $(".reword_person").html(topHTML);
        console.log("✅ تم عرض الفائزين!");
        
        // إذا كان المستخدم الحالي من الفائزين، عرض مكسبه
        var currentUserWinAmount = 0;
        var currentUserIsWinner = false;
        
        for (var i = 0; i < topList.length; i++) {
            var winner = topList[i];
            if (winner.uid === info.uid || winner.userId === info.uid) {
                currentUserWinAmount = winner.total || winner.winGold || 0;
                currentUserIsWinner = true;
                break;
            }
        }
        
        if (currentUserIsWinner) {
            console.log("🎉 المستخدم الحالي فائز! المكسب:", currentUserWinAmount);
            $(".reword_word>div:first-child>div:last-child")[0].innerHTML = formatNumber(currentUserWinAmount);
            
            // ✅ إصلاح: عرض صورة المستخدم الفائز باستخدام avatar من الخادم
            var selfImg = $(".prize .self img")[0];
            if (selfImg) {
                // استخدام avatar من الخادم (URL مباشر)
                var userAvatarUrl = avatar || extractImageUrl(info.avatar);
                console.log("🖼️ محاولة عرض صورة المستخدم الفائز:", userAvatarUrl);
                selfImg.src = userAvatarUrl;
                selfImg.onerror = function() { 
                    console.log("❌ فشل تحميل الصورة، عرض الصورة الافتراضية");
                    this.src = 'images/default_avatar.png'; 
                };
                console.log("✅ صورة المستخدم الفائز تم تعيينها:", userAvatarUrl);
            }
        } else {
            console.log("😢 المستخدم الحالي ليس من الفائزين");
            $(".reword_word>div:first-child>div:last-child")[0].innerHTML = "0";
            
            var selfImg = $(".prize .self img")[0];
            if (selfImg) {
                selfImg.src = "https://parse410.onrender.com/try/images/default_avatar.png";
            }
        }
        
    } else {
        console.log("😢 لا يوجد فائزون، عرض noPrize");
        $(".reword").show();
        $(".noPrize").show();
        $(".prize").hide();
        
        // عرض صورة الفاكهة الفائزة
        var noPrizeImg = $(".noPrize>div img:last-child")[0];
        if (noPrizeImg) {
            var fruitImagePath = getGiftImagePath(fruitNumber);
            noPrizeImg.src = fruitImagePath;
            console.log("✅ صورة الفاكهة في noPrize:", fruitImagePath);
        }
        
        // عرض نص الجولة
        if (info.lang == "ar") {
            $(".reword .roundWord").html("جولة " + (round - 1) + " النتيجة");
            $(".noPrize .roundWord").html("جولة " + (round - 1) + " النتيجة");
        } else {
            $(".reword .roundWord").html("The result of " + (round - 1) + " round:");
            $(".noPrize .roundWord").html("The result of " + (round - 1) + " round:");
        }
        
        $(".reword_person").html("");
    }
    
    // بدء عد تنازلي للإغلاق
    if (resultTimer) clearInterval(resultTimer);
    resultCount = 5;
    
    resultTimer = setInterval(function() {
        resultCount--;
        if (resultCount <= 0) {
            clearInterval(resultTimer);
            $(".reword").hide();
            $(".prize").hide();
            $(".noPrize").hide();
            console.log("⏰ انتهى وقت عرض النتيجة");
        }
        var countDownElement = $(".reword .reword_content .countDown")[0];
        if (countDownElement) {
            countDownElement.innerHTML = resultCount + "s";
        }
    }, 1000);
    
    console.log("🎊 ===== انتهى عرض النتيجة ===== 🎊");
}

function countDown() {
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
    console.log("sureClick called - choice:", choice, "index:", index);
    
    let currentBalance = parseFloat($('.balanceCount').text().replace(/,/g, ''));
    if (currentBalance < currentGold) {
        showSuccess(info.lang == "ar" ? "رصيد غير كافٍ!" : "Insufficient balance!");
        return;
    }

    $('.balanceCount').text(formatNumber((currentBalance - currentGold).toFixed(2)));
    
    var fruitNumber = searchGift(choice);
    $(`.item${fruitNumber}`).addClass("active");
    
    var tempElement = $(`.item${fruitNumber} .selected div:nth-child(2) div`)[0];
    if (tempElement) {
        var temp = tempElement.innerHTML.replace(/,/g, '');
        tempElement.innerHTML = formatNumber(parseInt(temp) + parseInt(currentGold));
        $(`.item${fruitNumber} .selected`).show();
    }

    callFlutterApp('game_choice', {
        choice: choice,
        gold: currentGold
    }).then(function(res) {
        console.log("Choice response:", res);
        if (res.code == 200) {
            selectCount += 1;
            if (!selectArr.includes(choice)) {
                selectArr.push(choice);
            }

            if (res.balance !== undefined) {
                $('.balanceCount').text(formatNumber(parseFloat(res.balance).toFixed(2)));
                if (info.credits !== undefined) {
                    info.credits = res.balance;
                }
            }
        } else if (res.code == 10062) {
            showSuccess(info.lang == "ar" ? "يرجى الشحن" : "Please recharge");
            $('.balanceCount').text(formatNumber(currentBalance.toFixed(2)));
            $(`.item${fruitNumber}`).removeClass("active");
            tempElement.innerHTML = formatNumber(parseInt(tempElement.innerHTML.replace(/,/g, '')) - parseInt(currentGold));
        } else {
            showSuccess(res.message || 'Error');
            $('.balanceCount').text(formatNumber(currentBalance.toFixed(2)));
            $(`.item${fruitNumber}`).removeClass("active");
            tempElement.innerHTML = formatNumber(parseInt(tempElement.innerHTML.replace(/,/g, '')) - parseInt(currentGold));
        }
    }).catch(function(error) {
        console.error("Choice error:", error);
        showSuccess(info.lang == "ar" ? "خطأ في النظام" : "System Error");
        $('.balanceCount').text(formatNumber(currentBalance.toFixed(2)));
        $(`.item${fruitNumber}`).removeClass("active");
        if (tempElement) {
            tempElement.innerHTML = formatNumber(parseInt(tempElement.innerHTML.replace(/,/g, '')) - parseInt(currentGold));
        }
    });
}

function roll(dir) {
    hideHand();
    selectCount = 0;
    selectArr = [];
    $(".title1").hide();
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
        var selectedDiv = $(".item" + (i + 1) + " .selected div:nth-child(2) div")[0];
        if (selectedDiv) {
            selectedDiv.innerHTML = "0";
        }
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
}

function bindEvent() {
    console.log("Binding events...");
    
    $(".clickArea .clickItem").click(function() {
        console.log("Gold item clicked");
        $(".clickItem").removeClass("active");
        $(this).addClass("active");
        var index = $(this).data("index");
        currentGold = goldList[index] || 1;
        console.log("Selected gold:", currentGold);
    });
    
    $(".item").click(function() {
        console.log("Fruit item clicked, status:", status);
        if (status == 0) {
            var index = $(this).data("index");
            console.log("Item index:", index);
            
            for (var i = 0; i < $(".item").length; i++) {
                $(".item" + (i + 1)).removeClass("active");
            }
            
            console.log("selectCount:", selectCount, "selectArr:", selectArr);
            
            var isHas = false;
            for (var i = 0; i < selectArr.length; i++) {
                if (selectArr[i] == choiceList[index]) {
                    isHas = true;
                    break;
                }
            }
            
            if (selectArr.length > 5 && !isHas) {
                showSuccess("Max Selected");
                return;
            }

            sureClick(choiceList[index], index);
        }
    });
    
    $(".records").click(function() {
        console.log("Records clicked");
        getBill();
        $(".recordsBg").show();
    });
    
    $(".recordsBg .modalBack").click(function() {
        $(".recordsBg").hide();
    });

    $(".rule").click(function() {
        console.log("Rule clicked");
        $(".ruleBg").show();
    });
    
    $(".ruleBg").click(function() {
        $(".ruleBg").hide();
    });

    $(".rank").click(function() {
        console.log("Rank clicked");
        getRank();
        $(".rankBg").show();
    });
    
    $(".rankBg .modalBack").click(function() {
        $(".rankBg").hide();
    });
    
    $(".reword, .rewordNo, .pop-success").click(function(e) {
        e.stopPropagation();
    });

    try {
        document.addEventListener("visibilitychange", function() {
            if (document.hidden) {
                hideLock = true;
                sessionStorage.setItem("currentRound", round);
                if (countTimer) clearInterval(countTimer);
                if (handTimer) clearInterval(handTimer);
            } else {
                if (hideLock) {
                    hideLock = false;
                    getInfo();
                    showHand();
                }
            }
        });
    } catch (e) {
        console.error("Visibility change error:", e);
    }
    
    console.log("Events bound successfully");
}

function fixImageUrl(url) {
    return extractImageUrl(url);
}

function getGiftImagePath(fruitNumber) {
    if (!fruitNumber || fruitNumber < 1 || fruitNumber > 8) {
        console.warn("Invalid fruit number:", fruitNumber);
        return 'https://parse410.onrender.com/try/images/gift_1.png';
    }
    return 'https://parse410.onrender.com/try/images/gift_' + fruitNumber + '.png';
}

function formatNumber(num) {
    if (num === null || num === undefined || num === '') return '0';
    var numStr = num.toString();
    numStr = numStr.replace(/,/g, '');
    
    var parts = numStr.split('.');
    var integerPart = parts[0];
    var decimalPart = parts.length > 1 ? '.' + parts[1] : '';
    
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return integerPart + decimalPart;
}

function searchGift(value) {
    if (!value) {
        console.warn("searchGift: No value provided");
        return 1;
    }
    
    console.log("searchGift searching for:", value);
    
    var result = fruitMap[value];
    
    if (!result) {
        console.warn("Invalid fruit value:", value, "valid values:", Object.keys(fruitMap));
        return 1;
    }
    
    console.log("Mapped fruit", value, "to number:", result);
    return result;
}

function callFlutterApp(action, params) {
    return new Promise(function(resolve, reject) {
        var requestId = 'req_' + (++requestIdCounter) + '_' + Date.now();
        
        pendingRequests[requestId] = {
            resolve: resolve,
            reject: reject
        };
        
        var message = {
            action: action,
            requestId: requestId,
            params: params || {}
        };
        
        console.log("Sending to Flutter:", message);
        
        if (window.FlamingoApp && typeof window.FlamingoApp.postMessage === 'function') {
            window.FlamingoApp.postMessage(JSON.stringify(message));
        } else if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
            window.flutter_inappwebview.callHandler('FlamingoApp', JSON.stringify(message));
        } else {
            console.warn("FlamingoApp not available, trying direct call");
            try {
                if (window.flutterChannel && typeof window.flutterChannel.postMessage === 'function') {
                    window.flutterChannel.postMessage(JSON.stringify(message));
                } else {
                    reject('Cannot communicate with Flutter: No channel available');
                }
            } catch (e) {
                reject('Cannot communicate with Flutter: ' + e);
            }
        }
        
        setTimeout(function() {
            if (pendingRequests[requestId]) {
                delete pendingRequests[requestId];
                reject('Request timeout');
            }
        }, 30000);
    });
}

function sendToFlutter(data) {
    try {
        if (window.FlamingoApp && typeof window.FlamingoApp.postMessage === 'function') {
            window.FlamingoApp.postMessage(JSON.stringify(data));
        } else if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
            window.flutter_inappwebview.callHandler('FlamingoApp', JSON.stringify(data));
        } else if (window.flutterChannel && typeof window.flutterChannel.postMessage === 'function') {
            window.flutterChannel.postMessage(JSON.stringify(data));
        }
    } catch (e) {
        console.error("Failed to send to Flutter:", e);
    }
}

/**
 * ✅ إصلاح: دالة getInfo محسّنة لتسجيل آخر فاكهة رابحة في الشريط
 */
function getInfo(_round, isChoice) {
    console.log("Getting game info...");
    
    var params = {};
    if (_round) {
        params.round = _round;
    }
    
    callFlutterApp('game_info', params).then(function(res) {
        console.log("Info response:", res);
        if (res.code === 200 && res.data) {
            if (res.data.countdown === undefined) {
                console.error("Invalid response data:", res.data);
                return;
            }
            
            if (res.data.countdown < 0) {
                showSuccess(info.lang == "ar" ? "خطأ في النظام، جاري إعادة الاتصال..." : "System Error, reconnecting...");
                
                clearAllTimers();
                
                setTimeout(function() {
                    getInfo();
                    showHand();
                }, 800);
                return;
            }

            var balanceCount = $(".balanceCount")[0];
            if (balanceCount) {
                balanceCount.innerHTML = formatNumber(parseFloat(res.data.gold).toFixed(2));
            }
            
            var profitCount = $(".profitCount")[0];
            if (profitCount) {
                profitCount.innerHTML = formatNumber(res.data.profit || 0);
            }
            
            var roundElement = $(".round")[0];
            if (roundElement) {
                roundElement.innerHTML = (info.lang == "ar" ? "جولة " : "Round ") + res.data.round;
            }

            if (status == 1 && isChoice) return;
            round = res.data.round;

            if (!isChoice) {
                countTime = res.data.countdown;
                var countDownElement = $(".coutDown")[0];
                if (countDownElement) {
                    countDownElement.innerHTML = countTime + "s";
                }
                
                if (countTimer) clearInterval(countTimer);
                countDown();
            }

            $(".title2").hide();
            $(".title1").show();

            // ✅ إصلاح: تحديث آخر فاكهة رابحة في الشريط
            if (res.data.result) {
                var fruitNumber = searchGift(res.data.result);
                console.log("🎯 Previous winning fruit:", res.data.result, "mapped to number:", fruitNumber);
                
                // حفظ آخر فاكهة رابحة
                lastWinningFruit = res.data.result;
                
                // إضافة active للفاكهة الفائزة
                $(".item" + fruitNumber).addClass("active");
                
                // تحديث صورة الفاكهة في noPrize1
                var noPrizeImg = $(".noPrize1>div img:last-child")[0];
                if (noPrizeImg) {
                    var fruitImagePath = getGiftImagePath(fruitNumber);
                    noPrizeImg.src = fruitImagePath;
                    console.log("✅ Updated noPrize1 image to fruit", fruitNumber, "path:", fruitImagePath);
                }
            }

            // ✅ إصلاح: تحديث قائمة النتائج (الشريط) بشكل صحيح
            var giftListHtml = "";
            var resultList = res.data.resultList || [];
            console.log("📊 Result list from server:", resultList);
            
            // عكس القائمة لعرض الأحدث أولاً
            var reversedList = resultList.slice().reverse();
            
            for (var i = 0; i < reversedList.length; i++) {
                var fruitNumber = searchGift(reversedList[i]);
                console.log(`📍 Result ${i}: ${reversedList[i]} -> fruit number ${fruitNumber}`);
                
                if (i == 0) {
                    // أول عنصر يحصل على شارة "جديد"
                    giftListHtml +=
                        '<div class="giftItem"><img src="' +
                        getGiftImagePath(fruitNumber) +
                        '" alt=""><img src="https://parse410.onrender.com/try/images/new.png" alt=""></div>';
                    console.log("✅ Added latest result with 'new' badge");
                } else {
                    giftListHtml +=
                        '<div class="giftItem"><img src="' +
                        getGiftImagePath(fruitNumber) +
                        '" alt=""></div>';
                }
            }
            
            // تحديث الشريط
            $(".giftList").html(giftListHtml);
            console.log("✅ Gift list updated successfully");

            if (_round) {
                clearInterval(handTimer);
                showHand();
            }

            // عرض الرهانات الحالية
            if (res.data.select && Object.keys(res.data.select).length > 0) {
                var ak = Object.keys(res.data.select);
                var vk = Object.values(res.data.select);
                console.log("Current bets:", res.data.select);
                
                for (var i = 0; i < ak.length; i++) {
                    var fruitNumber = searchGift(ak[i]);
                    console.log("Bet on fruit:", ak[i], "mapped to number:", fruitNumber, "amount:", vk[i]);
                    
                    var amountElement = $(".item" + fruitNumber + " .selected div:nth-child(2) div")[0];
                    if (amountElement) {
                        amountElement.innerHTML = formatNumber(vk[i]);
                    }
                    $(".item" + fruitNumber + " .selected").show();
                }
            } else {
                for (var i = 0; i < $(".item .gray").length; i++) {
                    var amountElement = $(".item" + (i + 1) + " .selected div:nth-child(2) div")[0];
                    if (amountElement) {
                        amountElement.innerHTML = "0";
                    }
                    $(".item" + (i + 1) + " .selected").hide();
                }
            }

            // عرض النتيجة إذا كانت هناك جولة سابقة
            if (_round) {
                console.log("🎯 ===== عرض نتيجة الجولة السابقة ===== 🎯");
                console.log("بيانات النتيجة من الخادم:", {
                    result: res.data.result,
                    top: res.data.top,
                    winGold: res.data.winGold,
                    avatar: res.data.avatar,
                    nickname: res.data.nickname
                });
                
                // عرض النتيجة مع الفائزين
                showResult(
                    res.data.result,
                    res.data.top || [],
                    res.data.winGold || 0,
                    res.data.avatar || ''
                );
            }
        }
    }).catch(function(error) {
        console.error("Info error:", error);
        showSuccess(info.lang == "ar" ? "خطأ في الاتصال" : "Connection error");
    });
}

function getBill() {
    callFlutterApp('game_bill', {}).then(function(res) {
        console.log("Bill response:", res);
        if (res.code == 200 && res.data) {
            var innerHTML = "";
            
            for (var i = 0; i < res.data.length; i++) {
                var tempItem = res.data[i];
                var isWin = tempItem.choice == tempItem.result;
                var choiceNumber = searchGift(tempItem.choice);
                var resultNumber = searchGift(tempItem.result || 'b');
                
                innerHTML +=
                    '<div class="records-list-item flex ac js"><div class="inner-item">' +
                    formatNumber(tempItem.gold) +
                    ' gold</div><div class="inner-item"> <img src="' +
                    getGiftImagePath(choiceNumber) +
                    '" alt=""> </div><div class="inner-item"><img src="' +
                    getGiftImagePath(resultNumber) +
                    '" alt=""></div><div class="inner-item"><div>' +
                    changeWord(isWin) +
                    "</div>" +
                    (isWin ?
                        "<div>(" +
                        timesWord[resultNumber - 1] +
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
    }).catch(function(error) {
        console.error("Bill error:", error);
    });
}

function getRank() {
    callFlutterApp('game_rank', {}).then(function(res) {
        console.log("Rank response:", res);
        if (res.code == 200 && res.data) {
            var innerHTML = "";
            var topHTML = "";
            
            for (var i = 0; i < res.data.length; i++) {
                var item = res.data[i];
                var avatarUrl = extractImageUrl(item.avatar);
                
                console.log(`Rank ${i + 1}: ${item.nick || item.username}, Avatar: ${avatarUrl}`);
                
                if (i < 3) {
                    topHTML +=
                        '<div class="personItem"><div class="logoArea"><div class="logo"><img src="' +
                        avatarUrl +
                        '" alt="" onerror="this.src=\'images/default_avatar.png\'" style="width: 100%; height: 100%; object-fit: cover;"></div> <img class="no' +
                        (i + 1) +
                        '" src="images/no' +
                        (i + 1) +
                        '.png" alt=""></div><div class="nick">' +
                        (item.nick || item.username || `User_${i + 1}`) +
                        '</div><div class="flex ac jc"><img src="images/gold.png" alt=""><div>' +
                        formatNumber(item.total || 0) +
                        '</div></div></div>';
                }
                
                innerHTML +=
                    '<div class="rank-list-item flex ac js"><div class="inner-item">' +
                    (i + 1) +
                    '</div><div class="inner-item flex ac"><div class="logo"><img src="' +
                    avatarUrl +
                    '" alt="" onerror="this.src=\'images/default_avatar.png\'" style="width: 100%; height: 100%; object-fit: cover;"></div><div>' +
                    (item.nick || item.username || `User_${i + 1}`) +
                    '</div></div><div class="inner-item"><img src="images/gold.png" alt=""><div>' +
                    formatNumber(item.total || 0) +
                    '</div></div></div>';
            }
            
            $(".rank-top").html(topHTML);
            $(".rank-list").html(innerHTML);
        }
    }).catch(function(error) {
        console.error("Rank error:", error);
    });
}

function clearAllTimers() {
    if (countTimer) clearInterval(countTimer);
    if (handTimer) clearInterval(handTimer);
    if (rollTimer) clearInterval(rollTimer);
    if (resultTimer) clearInterval(resultTimer);
}

function showSuccess(message) {
    console.log("Message:", message);
}

function changeLang(lang) {
    console.log("Language changed to:", lang);
}

function changeWord(isWin) {
    return isWin ? (info.lang == "ar" ? "فوز" : "Win") : (info.lang == "ar" ? "خسارة" : "Lose");
}

function changeTimesWord() {
    return info.lang == "ar" ? "مرات" : "times";
}

function showMessage(message) {
    console.log("Message:", message);
}
