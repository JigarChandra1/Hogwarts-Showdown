// TODO4: Reconnect feature (Instead of register new we could use old playerID if player has)


// ----------------------------------------------------------------
// -- Module setting
// ----------------------------------------------------------------

var express = require('express')
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var path = require('path');
const _ = require('lodash');

const CLUES = require('./clues.json');

const CardTypes = {
  HORCRUX: 'HORCRUX',
  AVADAKEDAVRA: 'AVADAKEDAVRA',
  EXPELLIARMUS: 'EXPELLIARMUS',
  PROTEGO: 'PROTEGO',
  CFC: 'CHOCOLATE-FROG-CARD',
  DH: 'DEATHLY-HALLOW',
  CB: 'CRYSTAL-BALL',
  ACCIO: 'ACCIO'
};

class Card {
  constructor(type, suite, number) {
    this.type = type;
    this.suite = suite;
    this.number = number;
  }
}

const CFC_SUITES = ['GRYFFINDOR', 'RAVENCLAW', 'HUFFLEPUFF', 'SLYTHERIN'];

const HORCRUXES = [5].reduce((acc, cnt) => {
  for (let i = 0; i < cnt; i++) {
    acc.push(new Card(CardTypes.HORCRUX));
  }
  return acc;
}, []);

const CRYSTAL_BALLS = [[2, 10], [3, 7]].reduce((acc, arr) => {
  for (let i = 0; i < arr[1]; i++) {
    acc.push(new Card(CardTypes.CB, null, arr[0]));
  }
  return acc;
}, []);

const CFC = [[3, 10]].reduce((acc, arr) => {
  for (let i = 0; i < arr[0]; i++) {
    for (let j = 1; j <= arr[1]; j++) {
      acc.push(new Card(CardTypes.CFC, CFC_SUITES[i], j));
    };
  }
  return acc;
}, []);

const AVADAKEDAVRA = [29].reduce((acc, cnt) => {
  for (let i = 0; i < cnt; i++) {
    acc.push(new Card(CardTypes.AVADAKEDAVRA));
  }
  return acc;
}, []);

const EXPELLIARMUS = [7].reduce((acc, cnt) => {
  for (let i = 0; i < cnt; i++) {
    acc.push(new Card(CardTypes.EXPELLIARMUS));
  }
  return acc;
}, []);

const PROTEGO = [21].reduce((acc, cnt) => {
  for (let i = 0; i < cnt; i++) {
    acc.push(new Card(CardTypes.PROTEGO));
  }
  return acc;
}, []);

const ACCIO = [18].reduce((acc, cnt) => {
  for (let i = 0; i < cnt; i++) {
    acc.push(new Card(CardTypes.ACCIO));
  }
  return acc;
}, []);

const HALLOWS = {
  EW: 'ELDER-WAND',
  RS: 'RESURRECTION-STONE',
  CI: 'CLOAK-OF-INVISIBILITY'
};

const DH = [new Card(CardTypes.DH, HALLOWS.EW), 
  new Card(CardTypes.DH, HALLOWS.RS), 
  new Card(CardTypes.DH, HALLOWS.CI)];


const ALBUS = 'Albus Dumbledore';
const HARRY = 'Harry Potter';
const VOLDEMORT = 'Voldemort';
const PETER = 'Peter Pettigrew';
const GOOD_FORCES = [ALBUS,'Kingsley Shacklebolt', 'Mad Eye Moody', HARRY, 'Nymphadora Tonks', 'Sirius Black'];
const EVIL_FORCES = [VOLDEMORT, 'Bellatrix Lestrange', 'Lucius Malfoy'];

const VERDICTS = {
  UNKOWN: 'UNKNOWN',
  FOE: 'FOE',
  ALLY: 'ALLY'
};

const MAX_HAND_CARDS = 5;

// ----------------------------------------------------------------
// -- Path and listen setting
// ----------------------------------------------------------------

server.listen(process.env.PORT || 8080);

console.log('Started app');

app.use('/',express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------
// -- Global DSs
// ----------------------------------------------------------------

// Global timestamp issuing PID to players
var globalIDStamp = 0;
// Global dictionary to maintain player states
var playerState = {};
var roomStates = {}
var viableTimeLimit = [60,120,180,360];

var defaultWordListName = "";
var wordLists = {"" : []};

const REQUIRED_PLAYERS = 7;
// ----------------------------------------------------------------
// -- DB related funcs
// ----------------------------------------------------------------
// TODO


// ----------------------------------------------------------------
// -- RoomRelated funcs
// ----------------------------------------------------------------

function initRoomInfo(rid){
  let roomInfo =
  {
    playerList : [],
    timelimit : 60,
    TLCur : 0,
    noDupMode : false,
    curWordListName : defaultWordListName,
    gameInfo : {
      responses: [],
      votes: [],
      numberOfRounds: 5,
      currRound: 0,
      results: [],
      awaitingResponders: [],
      awaitingVoters: []
    }
  };
  setRoomInfo(rid,roomInfo);
}
function setRoomInfo(rid,info){
  roomStates[rid.toString()] = info;
}

function getRoomInfo(rid){
  if (!(rid in roomStates)){
    initRoomInfo(rid);
  }
  return roomStates[rid.toString()];
}

function getGameInfo(rid){
  return roomStates[rid.toString()].gameInfo;
}
function setGameInfo(rid,info){
  roomStates[rid.toString()].gameInfo = info;
}

function getBotState(rid){
  return roomStates[rid.toString()].botState;
}

// ----------------------------------------------------------------
// -- InRoom & Game funcs
// ----------------------------------------------------------------

function getPlayerState(pid){
  return playerState[pid.toString()];
}

function setPlayerState(pid,state){
  playerState[pid.toString()] = state;
}

// TODO: Add room feature & control broadcast domain

function registerNewPlayer(socket){
  let newclient = {
    currentRoom : -1,
    playerName : "Human-Player " + globalIDStamp,
    globalPlayerID: globalIDStamp,
    _socket : socket
  };
  setPlayerState(globalIDStamp,newclient);
  globalIDStamp+=1;
  return getPlayerState(globalIDStamp-1);
}

function playerLeaveRoom(pid){
  let rid = getPlayerState(pid).currentRoom;
  if(rid == -1){
    return;
  }
  let roomInfo = getRoomInfo(rid);
  roomInfo.playerList = remove(roomInfo.playerList,pid);
  let player = getPlayerState(pid);
  player.state = "Outside";
  player.playerRole = "";
  player.currentRoom = -1;
  if(player.isRoomMaster){
    //When RoomMaster was removed we need reelection
    reelectMaster(rid);
  }
  notifyRoomInfo(rid);
}

function playerJoinRoom(pid,rid){
  let plyState = getPlayerState(pid);
  let roomInfo = getRoomInfo(rid);
  const gameInfo = getGameInfo(rid);
  playerLeaveRoom(pid);
  // Join new Room
  if(roomInfo.playerList.length==0){
    plyState.isRoomMaster = true;
    plyState.isReady4Gaming = true;
    plyState.isReady4NextRound = true;
    plyState.state = "InRoom";
  } else {
    if (getPlayerState(roomInfo.playerList[0]).state !== "InRoom") {
      plyState.state = getPlayerState(roomInfo.playerList[0]).state;
      roomInfo.playerList.push(pid);
      if (["Results", "GamingEnded"].includes(plyState.state)) {
        plyState._socket.emit('Results',gameInfo.results[gameInfo.results.length - 1]);
        if (plyState.state === "GamingEnded") {
          plyState._socket.emit('gameEnd');
        }
      }
      else if (gameInfo.votes.length) { // Restart round only if voting is in progress since new players response would not get considered
        restartRound(rid, plyState.playerName, true);
      } else {
        plyState._socket.emit('clueInfo',{
          clue: CLUES[gameInfo.currClueCategory][gameInfo.currClueIndex][0],
          category: gameInfo.currClueCategory
        });
        plyState._socket.emit('InProgressGameInfo',gameInfo);
        gameInfo.awaitingResponders.push(plyState.playerName);
      }
      plyState.currentRoom = rid;
      return;
    }
    else {plyState.state = "InRoom";}
  }
  plyState.currentRoom = rid;
  roomInfo.playerList.push(pid);
}

function registerNewBot(rid) {

}

function notifyRoomInfo(rid){
  // Pushing all info to client
  playerBuf = []
  let roomInfo = getRoomInfo(rid);
  for(let i=0;i<roomInfo.playerList.length;i++){
    let id = roomInfo.playerList[i];
    let pinfo = getPlayerState(id);
    playerBuf.push({
      playerID : pinfo.playerID,
      playerName : pinfo.playerName,
      state : pinfo.state,
      isRoomMaster : pinfo.isRoomMaster,
      isReady4Gaming: pinfo.isReady4Gaming,
      isReady4NextRound: pinfo.isReady4NextRound,
      // Player/Watcher
      playerRole : pinfo.playerRole,
      score: pinfo.score
    });
  }
  io.to(roomchannel(rid)).emit('roomInfo',{
    timelimit : roomInfo.timelimit,
    players : playerBuf
  });
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function notifyVotingOptions(rid) {
  const gameInfo = getGameInfo(rid),
  answer = CLUES[gameInfo.currClueCategory][gameInfo.currClueIndex][1].toLowerCase(),
  shuffledResponses = shuffle(gameInfo.responses.map(r => {
    const option = r.response ? r.response.toLowerCase(): "";
    return { option: option, playerID: r.playerID };
  }).concat([{option: answer}]));
  io.to(roomchannel(rid)).emit('votingOptions', shuffledResponses);
}

function reelectMaster(rid){
  let roomInfo = getRoomInfo(rid);
  let len = roomInfo.playerList.length;
  if(len==0){
    // It's no point to do anymore.
    return;
  }
  let target = Math.floor((Math.random()*len));
  let id = roomInfo.playerList[target];
  playerState[id].isRoomMaster = true;
  playerState[id].isReady4Gaming = true;
}

function resetGameInfo(rid) {
  const gameInfo = getGameInfo(rid);
  gameInfo.responses = [];
  gameInfo.votes = [];
  gameInfo.awaitingResponders = [];
  gameInfo.awaitingVoters = [];
  if (gameInfo.results.length === gameInfo.currRound + 1) {
    // Remove the current result
    gameInfo.results.splice(gameInfo.results.length -1, 1);
  }
  let roomInfo = getRoomInfo(rid);
  roomInfo.playerList.forEach(pId => {
    getPlayerState(pId).isReady4NextRound = false;
    getPlayerState(pId).state = "Gaming";
    gameInfo.awaitingResponders.push(getPlayerState(pId).playerName);
    gameInfo.awaitingVoters.push(getPlayerState(pId).playerName);
  });
}

function removePlayer(pid){
  let rid = getPlayerState(pid).currentRoom;
  let roomInfo = getRoomInfo(rid);
  roomInfo.playerList = remove(roomInfo.playerList,pid);
  let player = getPlayerState(pid);
  setPlayerState(pid,null);
  if(player.isRoomMaster){
    //When RoomMaster was removed we need reelection
    reelectMaster(rid);
  }
  notifyRoomInfo(rid);
}

function isAllReady(rid){
  let roomInfo = getRoomInfo(rid);
  // If only one player in room, refuse to start
  if(roomInfo.playerList.length<2){
    return false;
  }
  for(let i=0;i<roomInfo.playerList.length;i++){
    let id=roomInfo.playerList[i];
    let pinfo = getPlayerState(id);
    if(pinfo.isReady4Gaming==false){
      return false;
    }
  }
  return true;
}

function isAllResponded(rid){
  let roomInfo = getRoomInfo(rid);
  const gameInfo = getGameInfo(rid);
  return gameInfo.responses.length === roomInfo.playerList.length;
}

function isAllVoted(rid){
  let roomInfo = getRoomInfo(rid);
  const gameInfo = getGameInfo(rid);
  return gameInfo.votes.length === roomInfo.playerList.length;
}

function isAllReady4NextRound(rid) {
  let roomInfo = getRoomInfo(rid);
  return roomInfo.playerList.every(pId => getPlayerState(pId).isReady4NextRound);
}

function evaluateRound(rid) {
  const gameInfo = getGameInfo(rid),
  correctAnswererPlayerIds = gameInfo.votes.filter(v => v.vote === CLUES[gameInfo.currClueCategory][gameInfo.currClueIndex][1].toLowerCase()).map(v => v.playerID),
  spooks = gameInfo.responses.map(r => {
    return {
      SPOOKER_PLAYER_ID: r.playerID,
      SPOOKER_PLAYER_NAME: r.playerName,
      SPOOKED_PLAYER_IDS: gameInfo.votes.filter(v => v.vote.toLowerCase() === r.response.toLowerCase()).map(v => v.playerID),
      SPOOKED_PLAYER_NAMES: gameInfo.votes.filter(v => v.vote.toLowerCase() === r.response.toLowerCase()).map(v => v.playerName),
      response: r.response
    };
  }),
  results = {
            responses: _.cloneDeep(gameInfo.responses), 
            votes: _.cloneDeep(gameInfo.votes),
            correctAnswer: CLUES[gameInfo.currClueCategory][gameInfo.currClueIndex][1],
            spooks: spooks,
            correctAnswererPlayerIds: correctAnswererPlayerIds
          };
 
  spooks.forEach(s => {
    playerState[s.SPOOKER_PLAYER_ID].score += s.SPOOKED_PLAYER_IDS.length
    if(correctAnswererPlayerIds.includes(s.SPOOKER_PLAYER_ID)) {
      playerState[s.SPOOKER_PLAYER_ID].score += 1
    }
  });
  io.to(roomchannel(rid)).emit('Results', results);
  gameInfo.results.push(results);
  setAllPlayerStates(rid, "Results");
  notifyRoomInfo(rid);
}

function initGameInfo(rid){
  let roomInfo = getRoomInfo(rid);
  let gameInfo = {
    time : roomInfo.timelimit,
    wordGuessed : {},
    correctNum : 0,
    skipNum : 0,
    responses: [],
    votes: [],
    results: [],
    numberOfRounds: 5,
    currRound: 0,
    awaitingResponders: [],
    awaitingVoters: []
  };
  setGameInfo(rid,gameInfo);
}

function getNextWord(rid){
  let roomInfo = getRoomInfo(rid);
  const wordList = wordLists[roomInfo.curWordListName];
  let len = wordList.length;
  let target = Math.floor((Math.random()*len));
  return wordList[target];
}

function getNextClueIndex(category) {
  const idx = Math.floor((Math.random()*(CLUES[category].length - 1)));
  return idx;
}

function getNextClueCategory() {
  const idx = Math.floor((Math.random()*(Object.keys(CLUES).length - 1)));
  return Object.keys(CLUES)[idx];
}

function notifyNextWord(rid){
  let roomInfo = getRoomInfo(rid);
  let gameInfo = getGameInfo(rid);
  let nextword = getNextWord(rid);
  if(roomInfo.noDupMode){
    while(!gameInfo.wordGuessed[nextword]){
      nextword = getNextWord(rid);
    }
  }
  gameInfo.wordGuessed[nextword] = true;
  for(let i=0;i<roomInfo.playerList.length;i++){
    let id=roomInfo.playerList[i];
    let pinfo = getPlayerState(id);
    if(pinfo.playerRole!="Player"){
      pinfo._socket.emit('wordToGuess',nextword);
    }
    else{
      pinfo._socket.emit('wordToGuess',""); 
    }
  }
}

function notifyNextClue(rid){
  let roomInfo = getRoomInfo(rid);
  let gameInfo = getGameInfo(rid);
  let nextClueCategory = getNextClueCategory(),
  nextClueIndex = getNextClueIndex(nextClueCategory),
  nextClue = CLUES[nextClueCategory][nextClueIndex];

  gameInfo.currClueIndex = nextClueIndex;
  gameInfo.currClueCategory = nextClueCategory;
  // handle already asked clues
  for(let i=0;i<roomInfo.playerList.length;i++){
    let id=roomInfo.playerList[i];
    let pinfo = getPlayerState(id);
    pinfo._socket.emit('clueInfo',{
      clue: nextClue[0],
      category: nextClueCategory
    });
  }
}

function generateWinnerNames(players) {
  var max = -Infinity;
  var winnerNames = [];
  for (var i = 0; i < players.length; i++) {
      if (players[i].score === max) {
        winnerNames.push(players[i].playerName);
      } else if (players[i].score > max) {
          winnerNames = [players[i].playerName]
          max = players[i].score;
      }
  }
  return winnerNames;
}

function notifyGameEnd(rid){
  const roomInfo = getRoomInfo(rid),
  gameInfo = getGameInfo(rid);
  const players = roomInfo.playerList.map(pId => getPlayerState(pId));
  gameInfo.winnerNames = generateWinnerNames(players);
  notifyGameInfo(rid);
  setAllPlayerStates(rid, "GamingEnded");
  io.to(roomchannel(rid)).emit('gameEnd',"");
  cleanUpGame(rid);
}
function notifyGameInfo(rid){
  io.to(roomchannel(rid)).emit('gameInfo',getGameInfo(rid));
}

function getCharacterCards() {
  return shuffle(shuffle(GOOD_FORCES).slice(0, 3).concat(EVIL_FORCES).concat([PETER]));
}

function setInitialBotDeductions(botState, players) {
  botState.forEach(state => {
    const selfPlayer = players.find(p => state.playerID === p.ID),
    otherPlayers = players.filter(p => state.playerID !== p.ID);
    state.playerDeductions = [];
    otherPlayers.forEach(other => {
      if (!other.Character.revealed) {
        state.playerDeductions.push({playerID: other.ID, verdict: VERDICTS.UNKOWN});
      }
      else if (EVIL_FORCES.includes(selfPlayer.Character.name) 
      || selfPlayer.Character.name === PETER) {
        // Peter treats evil forces as ally until all good force characters are killed
        if (EVIL_FORCES.includes(other.Character.name)) {
          state.playerDeductions.push({playerID: other.ID, verdict: VERDICTS.ALLY});
        }
        else {
          state.playerDeductions.push({playerID: other.ID, verdict: VERDICTS.FOE});
        }
      }
      else if (GOOD_FORCES.includes(selfPlayer.Character.name)) {
        if (GOOD_FORCES.includes(other.Character.name)) {
          state.playerDeductions.push({playerID: other.ID, verdict: VERDICTS.ALLY});
        }
        else {
          state.playerDeductions.push({playerID: other.ID, verdict: VERDICTS.FOE});
        }
      }
    });
  });
}

function initGame(roomInfo){
  let len = roomInfo.playerList.length;
  const characterCards = getCharacterCards();
  const gameInfo = {
    Players: [], 
    DiscardPile: [],
    HorcruxDeck: Array.from(HORCRUXES),
    AvadaKedavraDeck: Array.from(AVADAKEDAVRA).splice(0, 7),
    DeathlyHallowDeck: shuffle(Array.from(DH)),
    Rounds: 0,
    Events: [],
    HallowsObtained: 0
  };
  const shuffledPlayerIds = shuffle([0,1,2,3,4,5,6]);
  for (let i = 0; i < len; i++) {
      const pinfo = getPlayerState(roomInfo.playerList[i]);
      const ID = shuffledPlayerIds[i];
      pinfo.ID = ID;
      const characterCard = characterCards[i],
        revealed = [VOLDEMORT, ALBUS, HARRY].includes(characterCard);
      
      gameInfo.Players.push(
        {
          Hand: [],
          FaceUpCards: [],
          Character: {name: characterCard, revealed: revealed},
          HorcruxCount: characterCard === VOLDEMORT ? 4 : 3,
          ID: ID,
          name: pinfo.playerName,
          isDisarmed: false,
          globalPlayerID: pinfo.globalPlayerID,
          isBot: false
        });
  }
  roomInfo.botState = [];
  if (len < REQUIRED_PLAYERS) {
    for (let i = len; i < REQUIRED_PLAYERS; i++) {
      const ID = shuffledPlayerIds[i],
        characterCard = characterCards[i],
        revealed = [VOLDEMORT, ALBUS, HARRY].includes(characterCard);
      roomInfo.botState.push({playerID: shuffledPlayerIds[i]});
      gameInfo.Players.push(
        {
          Hand: [],
          FaceUpCards: [],
          Character: {name: characterCard, revealed: revealed},
          HorcruxCount: characterCard === VOLDEMORT ? 4 : 3,
          ID: ID,
          name: 'bot',
          isDisarmed: false,
          isBot: true
        });
    }
  }

  const MAIN_CARDS = shuffle(CRYSTAL_BALLS.concat(CFC).concat(AVADAKEDAVRA).concat(EXPELLIARMUS).concat(PROTEGO).concat(ACCIO));
  for (let i = 0; i < MAX_HAND_CARDS; i++) {
    for (let j = 0; j < REQUIRED_PLAYERS; j++) {
      const card = MAIN_CARDS.splice(((i * REQUIRED_PLAYERS) + j), 1)[0];
      gameInfo.Players[j].Hand.push(card);
    }
  }
  gameInfo.MainDeck = MAIN_CARDS;
  gameInfo.currPlayerTurnID = gameInfo.Players[0].ID;
  setInitialBotDeductions(roomInfo.botState, gameInfo.Players);
  //console.log('Verify player deductions: ' + JSON.stringify(roomInfo.botState, null, 2));
  roomInfo.gameInfo = gameInfo;
  console.log(gameInfo.Players.map((p, idx) => idx + ' ' + p.Character.name).join(','));
}

function setAllPlayerStates(rid, state) {
  const roomInfo = getRoomInfo(rid);
  for(let i=0;i<roomInfo.playerList.length;i++){
    let id=roomInfo.playerList[i];
    let pinfo = getPlayerState(id);
    pinfo.state = state;
  }
}

function cleanUpGame(rid){
  let roomInfo = getRoomInfo(rid);
  initGameInfo(rid);
  for(let i=0;i<roomInfo.playerList.length;i++){
    let id=roomInfo.playerList[i];
    let pinfo = getPlayerState(id);
    pinfo.state = "GamingEnded";
    pinfo.playerRole = "";
    pinfo.isReady4Gaming = false;
  }
  notifyRoomInfo(rid);
}

function restartGame(rid){
  let roomInfo = getRoomInfo(rid);
  initGameInfo(rid);
  for(let i=0;i<roomInfo.playerList.length;i++){
    let id=roomInfo.playerList[i];
    let pinfo = getPlayerState(id);
    pinfo.state = "InRoom";
    pinfo.playerRole = "";
    pinfo.isReady4Gaming = pinfo.isRoomMaster ? true : false;
    pinfo.score = 0;
  }
  notifyRoomInfo(rid);
}

function drawCard(player, gameInfo) {
  if (!gameInfo.MainDeck.length) {
    const cards  = shuffle(gameInfo.DiscardPile);
    gameInfo.MainDeck = cards;
    gameInfo.DiscardPile = [];
  }
  const card = gameInfo.MainDeck.shift();
  console.log(`${player.Character.name} drew a ${card.type}`);
  player.Hand.push(card);
  if (player.Character.name === ALBUS) {
    if (!gameInfo.MainDeck.length) {
      const cards  = shuffle(gameInfo.DiscardPile);
      gameInfo.MainDeck = cards;
      gameInfo.DiscardPile = [];
    }
    const otherCard = gameInfo.MainDeck.shift();
    console.log(`${player.Character.name} drew a ${otherCard.type}`);
    player.Hand.push(otherCard);
  }
}

function discardCard(cardIdx, player, gameInfo) {
  const card = player.Hand.splice(cardIdx, 1)[0];
  gameInfo.DiscardPile.push(card);
}

function hasConsecutiveCombination(cfcCards, count) {
  const countBySuites = _.groupBy(cfcCards, c => c.suite);
  const suiteWithCount = Object.keys(countBySuites).find(k => countBySuites[k].length === count);
  if (suiteWithCount) {
    var hasConsecutiveCombination = true;
    const orderedCards = cfcCards.filter(c => c.suite === suiteWithCount).sort((a, b) => {a.number - b.number});
    let curr = orderedCards[0];
    for (let i = 1; i < count; i++) {
      if (orderedCards[i] !== (curr + 1)) {
        hasConsecutiveCombination = false;
        break;
      }
      curr = orderedCards[i];
    }
    if (hasConsecutiveCombination) {
      return true;
    }
  }
  return false;
}

function hasNumberCombination(cfcCards, count) {
  const countByNumber = _.groupBy(cfcCards, c => c.number);
  if (Object.keys(countByNumber).some(k => countByNumber[k].length === count)) {
    return true;
  }
  return false;
}

function hasCombination(HandCards, count) {
  const cfcCards = HandCards.filter(c => c.type === CardTypes.CFC);
  if (hasConsecutiveCombination(cfcCards, count) || hasNumberCombination(cfcCards, count)) {
    return true;
  }
  return false;
}

function hasRedundantCFC(HandCards) {
  const cfcCards = player.Hand.filter(c => c.type === CardTypes.CFC);
  const consecutiveCombination = hasConsecutiveCombination(cfcCards, 2);
  const numberCombination = hasNumberCombination(cfcCards, 2);
  if (consecutiveCombination && numberCombination) {
    return false;
  }
  return true;
}

function getNonCombinationCFCIndex(HandCards) {
  const cfcCards = player.Hand.filter(c => c.type === CardTypes.CFC);
  const countBySuites = _.groupBy(cfcCards, c => c.suite);
  const possibleCombinationSuite = Object.keys(countBySuites).find(k => countBySuites[k].length === 2);
  if (possibleCombinationSuite) {
    return player.Hand.findIndex(c => c.type === CardTypes.CFC && c.suite !== possibleCombinationSuite);
  }
  const countByNumber = _.groupBy(cfcCards, c => c.number);
  const possibleCombinationNumber = Object.keys(countByNumber).find(k => countByNumber[k].length === 2);
  if (possibleCombinationNumber) {
    return player.Hand.findIndex(c => c.type === CardTypes.CFC && c.number !== possibleCombinationNumber);
  }
  return player.Hand.findIndex(c => c.type === CardTypes.CFC);
}

function discardExcessCards(player, gameInfo) {
  while (player.Hand.length > MAX_HAND_CARDS) {
    if (player.FaceUpCards.some(c => c.type === CardTypes.CB)
    && player.Hand.some(c => c.type === CardTypes.CB)) {
      const cardIdx = player.Hand.findIndex(c => c.type === CardTypes.CB);
      discardCard(cardIdx, player, gameInfo);
      continue;
    }

    if (player.Hand.some(c => c.type === CardTypes.CFC)) {
      // TODO: Discard CFC always if all hallows have been taken

      // TODO: track count of discarded CFC by suite to access odds of getting 
      // a CFC of our suite
      const cfcCount = player.Hand.filter(c => c.type === CardTypes.CFC);
      if (cfcCount > 3) {
        if (!hasCombination(player.Hand, 3) && hasRedundantCFC(player.Hand)) {
          const cardIdx = getNonCombinationCFCIndex(player.Hand);
          discardCard(cardIdx, player, gameInfo);
          continue;
        }
      }
    }

    const accioCardIdx = player.Hand.findIndex(c => c.type === CardTypes.ACCIO);
    if (accioCardIdx > -1) {
      discardCard(accioCardIdx, player, gameInfo);
      continue;
    }

    const protegoCardIdx = player.Hand.findIndex(c => c.type === CardTypes.PROTEGO);
    if (protegoCardIdx > -1) {
      discardCard(protegoCardIdx, player, gameInfo);
      continue;
    }

    const expelliarmusCardIdx = player.Hand.findIndex(c => c.type === CardTypes.EXPELLIARMUS);
    if (expelliarmusCardIdx > -1) {
      discardCard(expelliarmusCardIdx, player, gameInfo);
      continue;
    }

    discardCard(0, player, gameInfo);
  }
}

function getHallowCard(player, gameInfo) {
  const cfcCards = player.Hand.filter(c => c.type === CardTypes.CFC);
  const countBySuites = _.groupBy(cfcCards, c => c.suite);
  const countByNumber = _.groupBy(cfcCards, c => c.number);
  const possibleCombinationSuite = Object.keys(countBySuites).find(k => countBySuites[k].length >= 3);
  var otherCards, tradeableCards;
  if (possibleCombinationSuite) {
    // TODO: take sequence into account since player could have 4 cards 
    otherCards = Array.from(player.Hand.filter(c => c.type === CardTypes.CFC && c.suite !== possibleCombinationSuite)).slice(0, 3);
    tradeableCards = Array.from(player.Hand.filter(c => c.type === CardTypes.CFC && c.suite === possibleCombinationSuite)).slice(0, 3);
  } else {
    const possibleCombinationNumber = Object.keys(countByNumber).find(k => countByNumber[k].length >= 3);
    otherCards = Array.from(player.Hand.filter(c => c.type === CardTypes.CFC && c.number !== possibleCombinationNumber)).slice(0, 3);
    tradeableCards = Array.from(player.Hand.filter(c => c.type === CardTypes.CFC && c.number !== possibleCombinationNumber)).slice(0, 3);
  }
  const event = `Player ${player.ID} (${player.name}) discarded: ${JSON.stringify(tradeableCards, null, 2)}`;
    gameInfo.DiscardPile.concat(tradeableCards);
    player.Hand = otherCards;
    console.log(event);
    gameInfo.Events.push(event);
    const hallowCard = gameInfo.DeathlyHallowDeck.shift();
    player.FaceUpCards.push(hallowCard);
    const hallowEvent = `Player ${player.ID} (${player.name}) obtained Deathly Hallow Card: ${JSON.stringify(hallowCard, null, 2)}`;
    console.log(hallowEvent);
    gameInfo.HallowsObtained += 1;
    gameInfo.Events.push(hallowEvent);
}

function getHorcruxCard(player, gameInfo) {
  gameInfo.HorcruxDeck.pop();
  player.HorcruxCount += 1;
  const horcruxEvent = `Player ${player.ID} (${player.name}) obtained Horcrux Card`;
  console.log(horcruxEvent);
  gameInfo.Events.push(horcruxEvent);
}

function getAvadaKedavraCard(player, gameInfo) {
  const card  = gameInfo.AvadaKedavraDeck.pop();
  player.Hand.push(card);
  const akEvent = `Player ${player.ID} (${player.name}) obtained Avada Kedavra Card`;
  console.log(akEvent);
  gameInfo.Events.push(akEvent);
}

function deckHasHallowCards(gameInfo) {
  return gameInfo.DeathlyHallowDeck.length > 0;
}

function checkAndActivateCB(player, gameInfo) {
  if (!player.FaceUpCards.find(c => c.type === CardTypes.CB)) {
    const cbCard = player.Hand.find(c => c.type === CardTypes.CB);
    if (cbCard) {
      const cbCardIdx = player.Hand.findIndex(c => c.type === CardTypes.CB);
      player.Hand.splice(cbCardIdx, 1);
      player.FaceUpCards.push(cbCard);
      const cbEvent = `${player.Character.name} activated Crystal Ball Card Level ${cbCard.number}`;
      //const cbEvent = `Player ${player.ID} (${player.name}) activated Crystal Ball Card Level ${cbCard.number}`;
      console.log(cbEvent);
      gameInfo.Events.push(cbEvent);
    }
  }
}

function shouldTrade() {
  return Math.floor(Math.random() * 100) < 40;
}

function getActivePlayersWithinReach(player, gameInfo) {
  const cb = player.FaceUpCards.find(c => c.type === CardTypes.CB), 
  playerReachLevel = cb ? cb.number : 1,
  selfIdx = gameInfo.Players.findIndex(p => p.ID === player.ID);
  var playersWithinReachIdx = [];
  if (playerReachLevel >= 1) {
    if (selfIdx === 0) {
      playersWithinReachIdx.push(REQUIRED_PLAYERS - 1);
    } else {
      playersWithinReachIdx.push(selfIdx - 1);
    }
    playersWithinReachIdx.push(((selfIdx + 1) % REQUIRED_PLAYERS));
  }
  if (playerReachLevel >= 2) {
    playersWithinReachIdx.push(((selfIdx + REQUIRED_PLAYERS) - 2) % REQUIRED_PLAYERS);
    playersWithinReachIdx.push(((selfIdx + 2) % REQUIRED_PLAYERS));
  }
  if (playerReachLevel === 3) {
    playersWithinReachIdx.push(((selfIdx + REQUIRED_PLAYERS) - 3) % REQUIRED_PLAYERS);
    playersWithinReachIdx.push(((selfIdx + 3) % REQUIRED_PLAYERS));
  }
  return gameInfo.Players.reduce((acc, p, idx) => {
    if (p.HorcruxCount && playersWithinReachIdx.includes(idx)) {
      acc.push(p);
    }
    return acc;
  }, []);
}

function updateBotDeductionsOnAttack(attackerPlayerId, targetedPlayerId, gameInfo, botState) {
  const targetedPlayer = gameInfo.Players.find(p => p.ID === targetedPlayerId);
  /**
   * TODO: more complex strategy:
   * 1. After 2 rounds, find players who have Voldemort within reach 
   * and verdict is unknown.
   * 2. These players can be assumed as evil forces since they are
   * not attacking Voldemort.
   */
  if (targetedPlayer.Character.name !== VOLDEMORT) {
    return;
  }
  botState.forEach(state => {
    if (state.playerID !== attackerPlayerId) {
      const player = gameInfo.Players.find(p => p.ID === state.playerID);
      const attackerDeduction = state.playerDeductions.find(d => d.playerID === attackerPlayerId);
      const foePlayerIds = state.playerDeductions.filter(d => d.verdict === VERDICTS.FOE).map(d => d.playerID);
      const activeFoePlayerCount = gameInfo.Players.filter(p => foePlayerIds.includes(p.ID) && p.HorcruxCount).length;
      const allyPlayerIds = state.playerDeductions.filter(d => d.verdict === VERDICTS.ALLY).map(d => d.playerID);
      const activeAllyPlayerCount = gameInfo.Players.filter(p => allyPlayerIds.includes(p.ID) && p.HorcruxCount).length;
      const voldemortPlayerId = gameInfo.Players.findIndex(p => p.Character.name === VOLDEMORT);
      if (player.Character.name === PETER &&
        foePlayerIds.includes(voldemortPlayerId) &&
        allyPlayerIds.length === 3 &&
        foePlayerIds.length === 3 &&
        activeFoePlayerCount < activeAllyPlayerCount) {
        // switch allegiance
        state.playerDeductions.forEach(d => {
          if (d.verdict === VERDICTS.ALLY) {
            d.verdict = VERDICTS.FOE;
          }
          else {
            d.verdict = VERDICTS.ALLY;
          }
        });
      }
      else if (EVIL_FORCES.includes(player.Character.name) || player.Character.name === PETER) {
        attackerDeduction.verdict = VERDICTS.FOE;
      }
      else if (GOOD_FORCES.includes(player.Character.name)) {
        attackerDeduction.verdict = VERDICTS.ALLY;
      }
    }
  });
}

function playAttackingCard(card, player, targetedPlayerId, gameInfo, botState) {
  if (card.type === CardTypes.AVADAKEDAVRA) {
    const cardIdx = player.Hand.findIndex(c => c.type === CardTypes.AVADAKEDAVRA);
    gameInfo.DiscardPile.push(player.Hand.splice(cardIdx, 1)[0]);
    const targetedPlayer = gameInfo.Players.find(p => p.ID === targetedPlayerId);
    targetedPlayer.HorcruxCount -= 1;
    const akEvent = `${player.Character.name} casted Avada Kedavra on ${targetedPlayer.Character.name}`;
    //const akEvent = `Player ${player.ID} (${player.name}) casted Avada Kedavra on Player ${targetedPlayerId} (${targetedPlayer.name})`;
    console.log(akEvent);
    if (!targetedPlayer.HorcruxCount) {
      console.log(targetedPlayer.Character.name + ' eliminated');
      targetedPlayer.Character.revealed = true;
    }
    gameInfo.Events.push(akEvent);
  }
  else {
    const cardIdx = player.Hand.find(c => c.type === card.type);
    gameInfo.DiscardPile.push(player.Hand.splice(cardIdx, 1)[0]);
    const targetedPlayer = gameInfo.Players.find(p => p.ID === targetedPlayerId);
    const attackEvent = `${player.Character.name} casted ${card.type} on ${targetedPlayer.Character.name}`;
    //const attackEvent = `Player ${player.ID} (${player.name}) casted ${card.type} on Player ${targetedPlayerId} (${targetedPlayer.name})`;
    console.log(attackEvent);
    gameInfo.Events.push(attackEvent);
    gameInfo.baseAttackCardType = card.type;
    gameInfo.currAttackerPlayerTurnID = player.ID;
    gameInfo.currTargetedPlayerTurnID = targetedPlayerId;
  }
  updateBotDeductionsOnAttack(player.ID, targetedPlayerId, gameInfo, botState);
}

function guessAndUpdateBotDeductions(gameInfo, botState) {
  const allGoodForceEliminated = gameInfo.Players.filter(p => p.Character.revealed
     && GOOD_FORCES.includes(p.Character.name) && !p.HorcruxCount).length === 3;
  if (allGoodForceEliminated) {
    // evil force do not know who Peter is, they assume all other players except Voldemort as foe and attack randomly
    // until Peter attacks Voldemort. With humans playing the game they would discuss a strategy to figure out Peter
    botState.forEach(state => {
      const self = gameInfo.Players.find(p => p.ID === state.playerID);
      const allies = state.playerDeductions.filter(d => d.verdict === VERDICTS.ALLY);
      allies.forEach(u => {
        const uPlayer = gameInfo.Players.find(p => p.ID === u.playerID);
        if (uPlayer.Character.name !== VOLDEMORT && self.Character.name !== PETER) {
          u.verdict = VERDICTS.FOE;
        }
        if (gameInfo.Players.filter(p => p.HorcruxCount).length === 2) {
          // last 2 ppl are always foes!
          u.verdict = VERDICTS.FOE;
        }
      });
    });
  }
  else if (gameInfo.Rounds >= 3) {
    botState.forEach(state => {
      const self = gameInfo.Players.find(p => p.ID === state.playerID);
      const unknowns = state.playerDeductions.filter(d => d.verdict === VERDICTS.UNKOWN);
      const allAlliesFound = state.playerDeductions.filter(d => d.verdict === VERDICTS.ALLY).length;
      unknowns.forEach(u => {
        const uPlayer = gameInfo.Players.find(p => p.ID === u.playerID);
        const playersWithinReach = getActivePlayersWithinReach(uPlayer, gameInfo);
        const isVoldemortWithinReach = playersWithinReach.some(p => p.Character.name === VOLDEMORT);
        if (isVoldemortWithinReach) {
          if (GOOD_FORCES.includes(self.Character.name)) {
            u.verdict = VERDICTS.FOE;
          }
          else {
            u.verdict = VERDICTS.ALLY;
          }
        }
        else if (self.Character.name !== PETER && allAlliesFound) {
          // since self player has max allies, everyone else has to be a foe
          u.verdict = VERDICTS.FOE;
        }
      });
    });
    // To facilitate placing breakpoint
    const x = 1;
  }
}

function endTurn(gameInfo, botState) {
  gameInfo.preDrawnCard = false;
  const currPlayerIdx = gameInfo.Players.findIndex(p => p.ID === gameInfo.currPlayerTurnID);
  let i = (currPlayerIdx + 1) % gameInfo.Players.length;
  while (true) {
    if (i === 0) {
      gameInfo.Rounds += 1;
  
      // TODO - debugging
      /**
       if (gameInfo.Rounds >= 10) {
        console.log('Inspect game');
      }
       */
  
      guessAndUpdateBotDeductions(gameInfo, botState);
      if (gameInfo.Rounds === 50) {
        // TODO - remove
        gameInfo.Aborted = true;
        gameInfo.GameEnded = true;
        return;
      }
      console.log('Starting Round ' + gameInfo.Rounds);
      console.log('Eliminated players: ' + gameInfo.Players.filter(p => !p.HorcruxCount).map(p => p.Character.name).join(','));
    }
    if (!gameInfo.Players[i].HorcruxCount) {
      i = (i + 1) % gameInfo.Players.length;
    }
    else if (gameInfo.Players[i].isDisarmed) {
      console.log(`Skipping turn of ${gameInfo.Players[i].Character.name} since they are disarmed`);
      gameInfo.Players[i].isDisarmed = false;
      i = (i + 1) % gameInfo.Players.length;
    }
    else {
      break;
    }
  }
  gameInfo.currPlayerTurnID = gameInfo.Players[i].ID;
  const goodForcePlayers = gameInfo.Players.filter(p => GOOD_FORCES.includes(p.Character.name));
  const evilForcePlayers = gameInfo.Players.filter(p => EVIL_FORCES.includes(p.Character.name));
  const voldemortPlayer = gameInfo.Players.find(p => p.Character.name === VOLDEMORT);
  const peterPlayer = gameInfo.Players.find(p => p.Character.name === PETER);
  const goodForceEliminated = goodForcePlayers.every(p => !p.HorcruxCount);
  const evilForceEliminated = evilForcePlayers.every(p => !p.HorcruxCount);
  if (goodForceEliminated && 
    !peterPlayer.HorcruxCount &&
    voldemortPlayer.HorcruxCount) {
    console.log('Voldemort wins after ' + gameInfo.Rounds);
    gameInfo.GameEnded = true;
    gameInfo.EvilForceWins = true;
  }
  if (!voldemortPlayer.HorcruxCount &&
    !goodForceEliminated
    ) {
      console.log('Good Force wins after ' + gameInfo.Rounds);
      gameInfo.GameEnded = true;
      gameInfo.GoodForceWins = true;
    }
  if (evilForceEliminated && goodForceEliminated) {
    console.log('Peter Pettigrew wins after ' + gameInfo.Rounds);
    gameInfo.GameEnded = true;
    gameInfo.PeterWins = true;
  }
  const playerWithAllDH = gameInfo.Players.find(p => p.FaceUpCards.filter(c => c.type === CardTypes.DH).length === 3);
  if (playerWithAllDH) {
    gameInfo.WinsByHallow = true;
    if (GOOD_FORCES.includes(playerWithAllDH.Character.name)) {
      console.log(playerWithAllDH.Character.name + ' obtained all Deathly Hallows');
      console.log('Good Force wins after ' + gameInfo.Rounds);
      gameInfo.GameEnded = true;
      gameInfo.GoodForceWins = true;
    }
    else if (EVIL_FORCES.includes(playerWithAllDH.Character.name)) {
      console.log(playerWithAllDH.Character.name + ' obtained all Deathly Hallows');
      console.log('Evil Force wins after ' +  gameInfo.Rounds);
      gameInfo.GameEnded = true;
      gameInfo.EvilForceWins = true;
    }
    else {
      console.log(playerWithAllDH.Character.name + ' obtained all Deathly Hallows');
      console.log('Peter wins after ' + gameInfo.Rounds);
      gameInfo.GameEnded = true;
      gameInfo.PeterWins = true;
    }
  }
}

function accioRandomCard(attacker, targeted, gameInfo) {
  if (!targeted.Hand.length) {
    return;
  }
  const idx = Math.floor(Math.random() * (targeted.Hand.length));
  if (idx >= targeted.Hand.length) {
    console.log('invalid');
  }
  const card = targeted.Hand.splice(idx, 1)[0];
  attacker.Hand.push(card);
  const accioEvent = `${attacker.Character.name} won the Accio duel and picked a ${card.type} card`;
  //const accioEvent = `Player ${attacker.ID} (${attacker.name}) won the Accio duel and picked a random card`;
  console.log(accioEvent);
  gameInfo.Events.push(accioEvent);
}

function accioFaceUpCard(attacker, targeted, gameInfo) {
  const types = [CardTypes.DH, CardTypes.CB];
  const idx = types.reduce((acc, type) => {
    if (acc !== -1) {
      return acc;
    }
    const cardIdx = targeted.FaceUpCards.findIndex(c => c.type === type);
    if (cardIdx !== -1) {
      return cardIdx
    }
    return acc;
  }, -1);
  if (idx !== -1) {
    const card = targeted.FaceUpCards.splice(idx, 1)[0];
    attacker.Hand.push(card);
    const accioEvent = `${attacker.Character.name} won the Accio duel and picked a ${card.type} card`;
    //const accioEvent = `Player ${attacker.ID} (${attacker.name}) won the Accio duel and picked a ${card.type} card`;
    console.log(accioEvent);
    gameInfo.Events.push(accioEvent);
  }
  else {
    throw new Error(`Player has unknown FaceUp cards: ${JSON.stringify(targeted.FaceUpCards, null, 2)}`);
  }
}

function notifyAccioChoose(gameInfo) {
  // TODO: notify human player through socket to choose a random card or a face-up card from opponent
  const currAttacker = gameInfo.Players.find(p => p.ID === gameInfo.currAttackerPlayerTurnID);
  const targetedPlayer = gameInfo.Players.find(p => p.ID === gameInfo.currTargetedPlayerTurnID);
  if (currAttacker.isBot) {
    if (targetedPlayer.FaceUpCards.length) {
      const chooseFaceUp = Math.floor(Math.random() * 100) < 50;
      if (chooseFaceUp) {
        accioFaceUpCard(currAttacker, targetedPlayer, gameInfo);
      }
      else {
        accioRandomCard(currAttacker, targetedPlayer, gameInfo);
      }
    }
    else {
      accioRandomCard(currAttacker, targetedPlayer, gameInfo);
    }
  }
}

function notifyDefense(gameInfo, botState) {
  // TODO: notify human player through socket
  const targetedPlayer = gameInfo.Players.find(p => p.ID === gameInfo.currTargetedPlayerTurnID);
  if (targetedPlayer.isBot) {
    const accioIdx = targetedPlayer.Hand.findIndex(c => c.type === CardTypes.PROTEGO);
    if (accioIdx > -1) {
      targetedPlayer.Hand.splice(accioIdx, 1);
      const tmp = gameInfo.currAttackerPlayerTurnID;
      gameInfo.currAttackerPlayerTurnID = gameInfo.currTargetedPlayerTurnID;
      gameInfo.currTargetedPlayerTurnID = tmp;
      const defenseEvent = `${targetedPlayer.Character.name} casted ${CardTypes.PROTEGO}`;
      //const defenseEvent = `Player ${targetedPlayer.ID} (${targetedPlayer.name}) casted ${CardTypes.PROTEGO}`;
      console.log(defenseEvent);
      gameInfo.Events.push(defenseEvent);
      notifyDefense(gameInfo, botState);
    }
    else {
      if (gameInfo.baseAttackCardType === CardTypes.EXPELLIARMUS) {
        console.log(`${targetedPlayer.Character.name} was disarmed`);
        targetedPlayer.isDisarmed = true;
      }
      else {
        notifyAccioChoose(gameInfo);
      }
      if (!gameInfo.preDrawnCard) {
        const currPlayer = gameInfo.Players.find(p => p.ID === gameInfo.currPlayerTurnID);
        drawCard(currPlayer, gameInfo);
      }
      endTurn(gameInfo, botState);
    }
  } else {
    console.log('Should not reach here in sim mode');
  }
}

function playBotTurn(player, botState, gameInfo) {
  if (player.Hand.length < MAX_HAND_CARDS) {
    drawCard(player, gameInfo);
    gameInfo.preDrawnCard = true;
  }
  if (player.Hand.length > MAX_HAND_CARDS) {
    discardExcessCards(player, gameInfo);
  }
  console.log(`Turn ${player.Character.name}, Horcrux:${player.HorcruxCount}, Hand: ${player.Hand.map(c => c.type === CardTypes.CFC ? c.suite.charAt(0) + c.number 
    : c.type).join(',')} , FaceUp: ${player.FaceUpCards.map(c => c.type === CardTypes.CB ?
       c.type.charAt(0) + c.number : c.type + c.suite).join(',')}`);
  /**
   * 1. Trade CFC if possible with a 40 \ 60 odd of trading 3 \ 4 CFC
   * 2. Apply Crystal Ball if none already active
   * 3. Get players within reach
   * 4. Check if there is an immediate winning move: kill foe or accio D.H
   * 5. Check if foe is within reach
   * 6. If yes, and if self is on evil force, apply spell on foe
   *    within reach of voldemort if his horcrux count is 1
   * 7. Else, check if self has accio and can use it to get a deathly hallow
   *    from an opponent
   * 8. If no foe is within reach, then end attack phase and draw card
   */

  /**
   * If attack card is used:
   * 1. Update currPlayerTurnID, currTargetedPlayerTurnID, baseAttackCardType
   * 2. update gameInfo.Events
   * 3. Notify human if targeted, else invoke bot turn for defending
   */

  if (hasCombination(player.Hand, 3) && deckHasHallowCards(gameInfo)) {
    getHallowCard(player, gameInfo);
  }
  checkAndActivateCB(player, gameInfo);

  // TODO - temp testing
  /** 
    if (GOOD_FORCES.includes(player.Character.name)) {
    if (player.FaceUpCards.some(c => c.type === CardTypes.CB)) {
      console.log('good force is ready');
    }
  }
  */
  

  const activePlayersWithinReach = getActivePlayersWithinReach(player, gameInfo),
  activeFoesWithinReach = activePlayersWithinReach.filter(p => {
    const state = botState.find(p => p.playerID === player.ID);
    const playerDeduction = state.playerDeductions.find(pB => pB.playerID === p.ID);
    return playerDeduction.verdict === VERDICTS.FOE;
  });
  activeFoesWithinReach.sort((a, b) => {
    if (player.Character.name === VOLDEMORT && a.Character.name === HARRY) {
      // avoid attacking harry since voldemort looses a Horcrux
      return 1;
    }
    if (player.Character.name === VOLDEMORT && b.Character.name === HARRY) {
      return -1;
    }
    if (player.Hand.some(c => c.type === CardTypes.ACCIO) &&
      a.FaceUpCards.some(c => c.type === CardTypes.DH)) {
      // priority to getting DH if player has an accio
      return -1;
    }
    if (player.Hand.some(c => c.type === CardTypes.ACCIO) &&
      b.FaceUpCards.some(c => c.type === CardTypes.DH)) {
      // priority to getting DH if player has an accio
      return 1;
    }
    if (GOOD_FORCES.includes(player.Character.name) && a.Character.name === VOLDEMORT) {
      // always try to first attack voldemort if player is on good force
      return -1;
    }
    if (GOOD_FORCES.includes(player.Character.name) && b.Character.name === VOLDEMORT) {
      // always try to first attack voldemort if player is on good force
      return 1;
    }
    return a.HorcruxCount -  b.HorcruxCount;
  });
  const attackingCardTypes = [CardTypes.AVADAKEDAVRA, CardTypes.ACCIO, CardTypes.EXPELLIARMUS];
  const attackingCard = attackingCardTypes.reduce((acc, type) => {
    if (acc) {
      return acc;
    }
    return player.Hand.find(c => c.type === type);
  }, null);
  if (attackingCard && activeFoesWithinReach.length) {
    var targetIdx = 0;
    var targetedPlayerId = activeFoesWithinReach[0].ID;
    const allGoodForceEliminated = gameInfo.Players.filter(p => p.Character.revealed
       && GOOD_FORCES.includes(p.Character.name) && !p.HorcruxCount).length === 3;
    if (allGoodForceEliminated) {
      console.log('Attacking randomly until Peter reveals himself through his attacks');
      targetIdx = Math.floor(Math.random() * activeFoesWithinReach.length);
      if (targetIdx === activeFoesWithinReach.length) {
        targetIdx -= 1;
      }
      targetedPlayerId = activeFoesWithinReach[targetIdx].ID;
      if (player.Character.name === PETER && activeFoesWithinReach > 1) {
        const foesWithoutVoldemort = activeFoesWithinReach.filter(p => p.Character.name !== VOLDEMORT);
        targetIdx = Math.floor(Math.random() * foesWithoutVoldemort.length);
        if (targetIdx === foesWithoutVoldemort.length) {
          targetIdx -= 1;
        }
        targetedPlayerId = foesWithoutVoldemort[targetIdx].ID;
      }
    }
    playAttackingCard(attackingCard, player, targetedPlayerId, gameInfo, botState);
    if ([CardTypes.ACCIO, CardTypes.EXPELLIARMUS].includes(attackingCard.type)) {
      notifyDefense(gameInfo, botState);
    }
    else {
      endTurn(gameInfo, botState);
    }
  }
  else {
    if (!gameInfo.preDrawnCard) {
      drawCard(player, gameInfo);
      if (player.Hand.length > MAX_HAND_CARDS) {
        discardExcessCards(player, gameInfo);
      }
    }
    endTurn(gameInfo, botState);
  }
}

function startNextRound(rid) {
  const gameInfo = getGameInfo(rid),
    botState = getBotState(rid),
    currPlayer = gameInfo.Players.find(p => p.ID === currPlayerTurnID);
  if (currPlayer.isBot) {
    playBotTurn(currPlayer, botState, gameInfo);
  }
  //notifyGameInfo(rid);
  //notifyRoomInfo(rid);
}

function removePlayerFromResults(player, results) {
    const result = results[results.length - 1],
      cleanedSpooks = result.spooks.reduce((acc, s) => {
        if (s.SPOOKER_PLAYER_ID === player.playerID) {
          return acc;
        }
        const cleanedSpookedPlayerIds = s.SPOOKED_PLAYER_IDS.filter(pId => pId !== player.playerID);
        s.SPOOKED_PLAYER_IDS = cleanedSpookedPlayerIds;
        acc.push(s);
        return acc;
      }, []);
      result.spooks = cleanedSpooks;
      return results;
}

function restartRound(rid, playerName, joinedGame) {
  resetGameInfo(rid);
  notifyNextClue(rid);
  notifyGameInfo(rid);
  notifyRoomInfo(rid);
  const reason = "Round was restarted since " + playerName + (joinedGame ? " joined" : " disconnected");
  io.to(roomchannel(rid)).emit("restartRound", reason);
}

function startGame(rid){
  let roomInfo = getRoomInfo(rid);
  initGame(rid);
  notifyGameInfo(rid);
  startNextRound(rid);
}

// TODO - temp test code
// Pending - DH effects, lily's charm effect
roomInfo = {playerList: []}
function startGameSim() {
  initGame(roomInfo);
}
const gameStats = [];
for (let i = 0; i < 100; i++) {
  console.log('Starting Game: ' + (i + 1));
  startGameSim();
  while (!roomInfo.gameInfo.GameEnded) {
    const gameInfo = roomInfo.gameInfo,
      botState = roomInfo.botState,
      idx = gameInfo.Players.findIndex(p => p.ID === gameInfo.currPlayerTurnID),
      currPlayer = gameInfo.Players[idx];
      playBotTurn(currPlayer, botState, gameInfo);
  }
  const stat = _.pick(roomInfo.gameInfo, ['GoodForceWins', 'EvilForceWins', 'PeterWins', 'Rounds', 'WinsByHallow', 'Aborted', 'HallowsObtained']);
  gameStats.push(stat);
}
const results = {};
results.goodForceWins = gameStats.filter(g => g.GoodForceWins).length;
results.avgGoodForceRounds = Math.floor(gameStats.filter(g => g.GoodForceWins).map(g => g.Rounds).reduceRight((total, round) => total + round, 0)/results.goodForceWins);
results.evilForceWins = gameStats.filter(g => g.EvilForceWins).length;
results.avgEvilForceRounds = Math.floor(gameStats.filter(g => g.EvilForceWins).map(g => g.Rounds).reduceRight((total, round) => total + round, 0)/results.evilForceWins);
results.peterWins = gameStats.filter(g => g.PeterWins).length;
results.avgPeterRounds = Math.floor(gameStats.filter(g => g.PeterWins).map(g => g.Rounds).reduceRight((total, round) => total + round, 0)/results.peterWins);
results.winsByHallow = gameStats.filter(g => g.WinsByHallow).length;
results.aborted = gameStats.filter(g => g.Aborted).length;
results.hallowsObtained = gameStats.map(g => g.HallowsObtained).reduceRight((total, count) => total + count, 0);
console.log('Results: ' + JSON.stringify(results, null, 2));
process.exit();

function isGameEnded(rid) {
  const gameInfo = getGameInfo(rid);
  return gameInfo.results.length === gameInfo.numberOfRounds;
}

function roomchannel(rid){
  return "_room" +rid.toString();
}

// ----------------------------------------------------------------
// -- Main Loop part
// ----------------------------------------------------------------


// Register all request handling func
io.on('connection', function (socket) {
  // Client States: Outside -> InRoom <--> Gaming 
  let clientState = registerNewPlayer(socket);
  let roomId = -1;
  socket.emit("id",clientState.globalPlayerID);
  // Can notify the basic setting of players (or declined until player join room)
  socket.on("join",(rid) =>{
    playerJoinRoom(clientState.globalPlayerID,rid);
    roomId = rid;
    clientState._socket.join(roomchannel(rid));
    notifyRoomInfo(rid);
  });
  socket.on("disconnect",(reason) => {
    try {
    removePlayer((clientState.globalPlayerID));
    const gameInfo = getGameInfo(clientState.currentRoom);
    if (getRoomInfo(clientState.currentRoom).playerList.length === 1) {
      restartGame(clientState.currentRoom);
    } else {
      // TODO: remove player from results if gaming state = results or gamingEnded
      const gameState = getRoomInfo(clientState.currentRoom).playerList.map(pId => getPlayerState(pId)).find(p => p.playerID !== clientState.playerID).state;
      if (['Results', 'GamingEnded'].includes(gameState)) {
        removePlayerFromResults(clientState, gameInfo.results);
      }
      else if (gameInfo.votes.length !==0) { // Reset round only if voting is in progress
        restartRound(clientState.currentRoom, clientState.playerName);
      } else {
        remove(gameInfo.awaitingResponders, clientState.playerName);
        notifyGameInfo(clientState.currentRoom);
      }
    }
    } catch(err) {
      console.log('Encountered error while disconnecting player: ' + err);
    }
  });
  // InRoom Related
  socket.on("changeTimeLimit",()=>{
    if(!sanityCheckR(clientState,roomId)){
      return;
    }
    let roomInfo = getRoomInfo(roomId);
    roomInfo.TLCur = (roomInfo.TLCur + 1) % viableTimeLimit.length;
    roomInfo.timelimit = viableTimeLimit[roomInfo.TLCur];
    notifyRoomInfo(roomId);
  });
  socket.on("changeName",(newName) => {
    if(!sanityCheckR(clientState,roomId)){
      return;
    }
    clientState.playerName = newName;
    notifyRoomInfo(roomId);
  });
  socket.on("Ready",() => {
    if(!sanityCheckR(clientState,roomId)){
      return;
    }
    clientState.isReady4Gaming = true;
    notifyRoomInfo(roomId);
  });

  socket.on("Unready",() => {
    if(!sanityCheckR(clientState,roomId)){
      return;
    }
    clientState.isReady4Gaming = false;
    notifyRoomInfo(roomId);
  });
  socket.on("Start",() => {
    if(!sanityCheckR(clientState,roomId)){
      return;
    }
    startGame(roomId);
  });

  // Game Related
  socket.on("Next",(result) => {
    if(!sanityCheckG(clientState,roomId)){
      return;
    }
    let gameInfo = getGameInfo(roomId);
    if(result=="Correct"){
      gameInfo.correctNum += 1;
      notifyNextWord(roomId); 
    }
    else if(result=="Skip"){
      gameInfo.skipNum += 1
      notifyNextWord(roomId);
    }
  });

  socket.on("Response", response => {
    let gameInfo = getGameInfo(roomId);
    gameInfo.responses.push({playerID: clientState.playerID, playerName: clientState.playerName, response: response});
    remove(gameInfo.awaitingResponders, clientState.playerName);
    notifyRoomInfo(roomId);
    notifyGameInfo(roomId);
    if(isAllResponded(roomId)) {
      notifyVotingOptions(roomId);
    }
  });

  socket.on("Vote", vote => {
    let gameInfo = getGameInfo(roomId);
    gameInfo.votes.push({playerID: clientState.playerID, playerName: clientState.playerName, vote: vote});
    remove(gameInfo.awaitingVoters, clientState.playerName);
    notifyRoomInfo(roomId);
    notifyGameInfo(roomId);
    if(isAllVoted(roomId)) {
      evaluateRound(roomId);
    }
    notifyRoomInfo(roomId);
    if(isGameEnded(roomId)) {
      notifyGameEnd(roomId);
    }
  });

  socket.on("NextRound",() => {
    clientState.isReady4NextRound = true;
    notifyRoomInfo(roomId);
    if(isAllReady4NextRound(roomId)) {
      startNextRound(roomId);
    }
  });
  socket.on("Restart",() => {
    restartGame(roomId);
  });
  socket.on("Error", error => {
    console.log('Received error: ' + JSON.stringify(error, null, 2));
  });
});

function sanityCheckR(clientState,roomId){
  if(clientState.state!="InRoom"){
    return false;
  }
  if(roomId == -1){
    return false;
  }
  return true;
}
function sanityCheckG(clientState,roomId){
  if(clientState.state!="Gaming"){
    return false;
  }
  if(roomId == -1){
    return false;
  }
  return true;
}
// ----------------------------------------------------------------
// -- Utility functions
// ----------------------------------------------------------------

function remove(array,val){
  let index = array.indexOf(val);
  if (index > -1) {
    array.splice(index, 1);
  }
  return array;
}
