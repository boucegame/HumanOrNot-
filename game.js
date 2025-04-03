const room = new WebsimSocket();
let gameState = {
  playerScore: 0,
  currentOpponentIsAI: false,
  chatMessages: [],
  timeLeft: 60,
  timerInterval: null,
  aiResponseDelay: null,
  decisionMade: false,
  savedGame: null
};

// AI personas for the game
const aiPersonas = [
  {
    name: "Friendly AI",
    style: "Friendly and helpful, uses lots of emojis",
    topics: ["technology", "hobbies", "weather", "movies", "games"]
  },
  {
    name: "Professional AI",
    style: "Formal and professional, uses technical language",
    topics: ["business", "science", "news", "education", "career"]
  },
  {
    name: "Creative AI",
    style: "Creative and artistic, uses metaphors and descriptive language",
    topics: ["art", "music", "literature", "creative writing", "imagination"]
  },
  {
    name: "Casual AI",
    style: "Casual and conversational, uses slang and abbreviations",
    topics: ["daily life", "social media", "entertainment", "food", "trends"]
  }
];

// DOM Elements
const screens = {
  mainMenu: document.getElementById('main-menu'),
  matchmaking: document.getElementById('matchmaking'),
  chatRoom: document.getElementById('chat-room'),
  decision: document.getElementById('decision-screen'),
  result: document.getElementById('result-screen'),
  howToPlay: document.getElementById('how-to-play-screen')
};

const elements = {
  playerScore: document.getElementById('player-score'),
  messageContainer: document.getElementById('message-container'),
  messageInput: document.getElementById('message-input'),
  sendButton: document.getElementById('send-message'),
  timeLeft: document.getElementById('time-left'),
  resultTitle: document.getElementById('result-title'),
  opponentType: document.getElementById('opponent-type'),
  pointsEarned: document.getElementById('points-earned')
};

// Initialize game
async function initializeGame() {
  try {
    await room.initialize();
    
    // Load saved game data
    const username = room.peers[room.clientId].username;
    const savedGames = room.collection('savedGame').filter({ username: username }).getList();
    if (savedGames && savedGames.length > 0) {
      // Find current user's saved game
      const userGame = savedGames[0];
      if (userGame) {
        gameState.savedGame = userGame;
        gameState.playerScore = userGame.score || 0;
      }
    }
    
    // Set up initial player state
    room.updatePresence({
      score: gameState.playerScore,
      inGame: false,
      ready: true
    });
    
    // Subscribe to presence updates
    room.subscribePresence((presence) => {
      // Update UI with connected players stats if needed
    });

    // Subscribe to room state updates
    room.subscribeRoomState((roomState) => {
      // Handle room state updates
    });

    // Listen for messages
    room.onmessage = handleMessage;

    // Initialize UI
    updatePlayerStats();
    
    // Add event listeners
    document.getElementById('start-game').addEventListener('click', startGame);
    document.getElementById('how-to-play').addEventListener('click', showHowToPlay);
    document.getElementById('back-to-menu').addEventListener('click', backToMainMenu);
    document.getElementById('choose-human').addEventListener('click', () => makeDecision('human'));
    document.getElementById('choose-ai').addEventListener('click', () => makeDecision('ai'));
    document.getElementById('continue-button').addEventListener('click', backToMainMenu);
    elements.sendButton.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    
  } catch (error) {
    console.error('Failed to initialize game:', error);
    addSystemMessage('Error connecting to server. Please try again later.');
  }
}

function handleMessage(event) {
  const data = event.data;
  
  switch (data.type) {
    case "chat":
      if (data.clientId !== room.clientId) {
        receiveMessage(data.message, data.clientId);
      }
      break;
    case "matchFound":
      matchFound(data.isAI, data.opponentId);
      break;
    case "timeUp":
      endChat();
      break;
    case "connected":
      console.log(`Client ${data.clientId} connected`);
      break;
    case "disconnected":
      if (data.clientId === gameState.currentOpponentId) {
        addSystemMessage('Your chat partner has disconnected.');
        clearTimeout(gameState.aiResponseDelay);
        clearInterval(gameState.timerInterval);
        switchToScreen(screens.mainMenu);
      }
      break;
  }
}

function startGame() {
  switchToScreen(screens.matchmaking);
  
  // Reset game state
  gameState.chatMessages = [];
  gameState.timeLeft = 60;
  clearInterval(gameState.timerInterval);
  clearTimeout(gameState.aiResponseDelay);
  
  // Update player status
  room.updatePresence({
    inGame: true,
    ready: true
  });
  
  // Find a match (AI or human)
  findMatch();
}

function findMatch() {
  // Simulate matchmaking delay
  setTimeout(() => {
    // 50% chance of matching with AI or human
    const matchWithAI = Math.random() > 0.5;
    
    if (matchWithAI || Object.keys(room.peers).length <= 1) {
      // Match with AI
      gameState.currentOpponentIsAI = true;
      matchFound(true);
    } else {
      // Find a human opponent
      const availablePlayers = Object.entries(room.presence)
        .filter(([clientId, presence]) => {
          return clientId !== room.clientId && 
                 presence.ready && 
                 presence.inGame;
        });
      
      if (availablePlayers.length > 0) {
        // Select a random player
        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        const [opponentId] = availablePlayers[randomIndex];
        gameState.currentOpponentId = opponentId;
        gameState.currentOpponentIsAI = false;
        
        // Notify both players
        room.send({
          type: "matchFound",
          isAI: false,
          opponentId: room.clientId
        });
        
        matchFound(false, opponentId);
      } else {
        // No human players available, match with AI
        gameState.currentOpponentIsAI = true;
        matchFound(true);
      }
    }
  }, 3000);
}

function matchFound(isAI, opponentId) {
  gameState.currentOpponentIsAI = isAI;
  
  if (isAI) {
    // Select a random AI persona
    const randomIndex = Math.floor(Math.random() * aiPersonas.length);
    gameState.currentAIPersona = aiPersonas[randomIndex];
  } else if (opponentId) {
    gameState.currentOpponentId = opponentId;
  }
  
  // Clear chat and prepare chat room
  elements.messageContainer.innerHTML = '';
  addSystemMessage('Connection established. You have 60 seconds to chat.');
  
  switchToScreen(screens.chatRoom);
  elements.messageInput.focus();
  
  // Start timer
  startTimer();
}

function startTimer() {
  gameState.timeLeft = 60;
  elements.timeLeft.textContent = gameState.timeLeft;
  
  gameState.timerInterval = setInterval(() => {
    gameState.timeLeft--;
    elements.timeLeft.textContent = gameState.timeLeft;
    
    if (gameState.timeLeft <= 0) {
      endChat();
    }
  }, 1000);
}

function sendMessage() {
  const message = elements.messageInput.value.trim();
  if (!message) return;
  
  // Add user message to chat
  addMessage(message, 'user');
  elements.messageInput.value = '';
  
  // If opponent is AI, generate response
  if (gameState.currentOpponentIsAI) {
    generateAIResponse();
  } else {
    // Send message to human opponent
    room.send({
      type: "chat",
      message: message,
      clientId: room.clientId
    });
  }
}

function receiveMessage(message, fromClientId) {
  if (fromClientId !== room.clientId) {
    addMessage(message, 'opponent');
  }
}

async function generateAIResponse() {
  // Simulate typing delay (1-3 seconds)
  const typingDelay = 1000 + Math.random() * 2000;
  
  // Get AI persona
  const persona = gameState.currentAIPersona;
  
  // Show typing indicator
  addSystemMessage(`Opponent is typing...`, 'typing-indicator');
  
  // Wait for typing delay
  gameState.aiResponseDelay = setTimeout(async () => {
    // Remove typing indicator
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
    
    try {
      // Get the last 3 messages to provide context
      const recentMessages = gameState.chatMessages.slice(-3)
        .map(msg => msg.text).join('\n');
      
      // Generate AI response using language model
      const prompt = `You are in a game where you must pretend to be a normal human having a chat conversation. Your goal is to convince the other person that you are a real human, not an AI. 

      Keep in mind these rules:
      1. DO NOT mention that you are an AI or that you're pretending to be human
      2. Act natural with FREQUENT typos, informal speech patterns, and abbreviations
      3. Keep responses VERY short (1 sentence max, preferably shorter)
      4. Don't use perfect grammar or punctuation
      5. Frequently use slang, abbreviations, or emojis
      6. Have strong personal opinions
      7. Sometimes start responses with lowercase letters
      8. Occasionally misspell words
      9. Avoid complete sentences - write the way people text
      10. Use "lol", "idk", "tbh", etc. frequently
      
      Your style is loosely: ${persona.style}
      You might discuss topics like: ${persona.topics.join(', ')}
      
      Recent messages: 
      ${recentMessages}
      
      Respond as a real human would in a casual text chat:`;
      
      // Use the AI API to generate a response
      const completion = await websim.chat.completions.create({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: gameState.chatMessages[gameState.chatMessages.length - 1].text }
        ]
      });
      
      const aiResponse = completion.content.trim();
      addMessage(aiResponse, 'opponent');
      
    } catch (error) {
      console.error('Error generating AI response:', error);
      // Fallback responses if AI generation fails
      const fallbackResponses = [
        "lol yeah",
        "idk maybe?",
        "that's cool tbh",
        "haha fr",
        "omg same",
        "ya i get that",
        "nah not rly",
        "wait srsly??",
        "lmaooo",
        "yea no i agree",
        "hmm idk bout that",
        "kinda tired tbh",
        "whatchu up to",
        "ya but like why tho",
        "ngl thats weird",
        "meh whatever",
      ];
      
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      addMessage(randomResponse, 'opponent');
    }
  }, typingDelay);
}

function addMessage(text, sender) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  
  if (sender === 'user') {
    messageElement.classList.add('user-message');
    messageElement.textContent = text;
    
    // Store message in game state
    gameState.chatMessages.push({
      sender: 'user',
      text: text
    });
  } else {
    messageElement.classList.add('opponent-message');
    messageElement.textContent = text;
    
    // Store message in game state
    gameState.chatMessages.push({
      sender: 'opponent',
      text: text
    });
  }
  
  elements.messageContainer.appendChild(messageElement);
  elements.messageContainer.scrollTop = elements.messageContainer.scrollHeight;
}

function addSystemMessage(text, className = 'system-message') {
  const messageElement = document.createElement('div');
  messageElement.classList.add(className);
  messageElement.textContent = text;
  
  elements.messageContainer.appendChild(messageElement);
  elements.messageContainer.scrollTop = elements.messageContainer.scrollHeight;
}

function endChat() {
  clearInterval(gameState.timerInterval);
  clearTimeout(gameState.aiResponseDelay);
  
  // Remove typing indicator if present
  const typingIndicator = document.querySelector('.typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
  
  // Reset decision made flag
  gameState.decisionMade = false;
  
  switchToScreen(screens.decision);
}

function makeDecision(choice) {
  // Prevent multiple decisions
  if (gameState.decisionMade) return;
  gameState.decisionMade = true;
  
  const isCorrect = (choice === 'ai' && gameState.currentOpponentIsAI) || 
                    (choice === 'human' && !gameState.currentOpponentIsAI);
  
  // Update UI based on decision
  elements.resultTitle.textContent = isCorrect ? 'CORRECT!' : 'WRONG!';
  elements.opponentType.textContent = gameState.currentOpponentIsAI ? 'AI' : 'HUMAN';
  
  if (isCorrect) {
    // Award points
    gameState.playerScore += 10;
    elements.pointsEarned.textContent = '+10 POINTS';
  } else {
    elements.pointsEarned.textContent = '0 POINTS';
  }
  
  // Update UI
  elements.playerScore.textContent = gameState.playerScore;
  
  // Update server
  room.updatePresence({
    score: gameState.playerScore,
    inGame: false,
    ready: true
  });
  
  // Save progress to database
  saveGameProgress();
  
  switchToScreen(screens.result);
}

// Save player progress to database
async function saveGameProgress() {
  try {
    const username = room.peers[room.clientId].username;
    // Get latest saved games to check for user's save
    const savedGames = room.collection('savedGame').filter({ username: username }).getList();
    const userGame = savedGames && savedGames.length > 0 ? savedGames[0] : null;
    
    if (userGame) {
      // Update existing record
      await room.collection('savedGame').update(userGame.id, {
        score: gameState.playerScore,
        username: username // Ensure username is included
      });
      gameState.savedGame = userGame;
    } else {
      // Create new record
      const savedGame = await room.collection('savedGame').create({
        score: gameState.playerScore,
        username: username // Include username in the record
      });
      gameState.savedGame = savedGame;
    }
    console.log('Game progress saved successfully', gameState.savedGame);
  } catch (error) {
    console.error('Error saving game progress:', error);
  }
}

function switchToScreen(screen) {
  // Clear any pending decision state if switching away from decision screen
  if (screens.decision !== screen && gameState.decisionMade === false) {
    gameState.decisionMade = false;
  }

  // Hide all screens
  Object.values(screens).forEach(s => {
    s.classList.remove('active');
  });
  
  // Show the requested screen
  screen.classList.add('active');
}

function updatePlayerStats() {
  elements.playerScore.textContent = gameState.playerScore;
}

function backToMainMenu() {
  switchToScreen(screens.mainMenu);
  
  // Update UI
  updatePlayerStats();
  
  // Reset game state for chat
  elements.messageContainer.innerHTML = '';
  elements.messageInput.value = '';
  
  // Update presence
  room.updatePresence({
    inGame: false,
    ready: true
  });
}
function showHowToPlay() {
  switchToScreen(screens.howToPlay);
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', initializeGame);
