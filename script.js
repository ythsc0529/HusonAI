const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

// 用一個陣列來儲存對話紀錄（包含角色是誰）
let conversationHistory = [];

// 網頁一打開就執行的初始化
function init() {
    const initialMessage = "我是 Huson，有什麼可以幫你的？";
    addMessageToChat('huson', initialMessage);
    
    // 把 Huson 的開場白也加進對話歷史
    conversationHistory.push({ role: 'model', parts: [{ text: initialMessage }] });
}

// 用來把訊息新增到聊天視窗的函式
function addMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (sender === 'user') {
        messageElement.classList.add('user-message');
    } else {
        messageElement.classList.add('huson-message');
    }
    
    messageElement.innerText = message;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight; // 自動捲到最新訊息
}

async function handleUserRequest() {
    const userText = userInput.value.trim();
    if (!userText) return;

    // 1. 在畫面上顯示使用者傳的訊息
    addMessageToChat('user', userText);
    
    // 2. 把使用者的訊息加到對話歷史
    conversationHistory.push({ role: 'user', parts: [{ text: userText }] });
    
    // 清空輸入框並顯示「正在輸入...」
    userInput.value = '';
    addMessageToChat('huson', '我想一下，雞掰...');

    try {
        // 3. 把「整串對話紀錄」丟給後端
        const response = await fetch('/.netlify/functions/get-gemini-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: conversationHistory }),
        });

        if (!response.ok) {
            throw new Error(`幹，伺服器出包了，代碼：${response.status}`);
        }

        const data = await response.json();
        const husonResponse = data.text;

        // 移除「我想一下...」那則訊息，換成真正的回覆
        chatWindow.removeChild(chatWindow.lastChild);
        addMessageToChat('huson', husonResponse);
        
        // 4. 把 Huson 的回覆也加到對話歷史
        conversationHistory.push({ role: 'model', parts: [{ text: husonResponse }] });

    } catch (error) {
        console.error("出錯了幹:", error);
        chatWindow.removeChild(chatWindow.lastChild);
        addMessageToChat('huson', "幹你娘，API 好像掛了，媽的。");
    }
}

sendButton.addEventListener('click', handleUserRequest);
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleUserRequest();
    }
});

// 啟動！
init();