'use strict';

const e = React.createElement;
import _ from 'lodash';
import logo from './images/hogwarts_showdown_logo.jpg'

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

class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }
  
    componentDidCatch(error, info) {
      const { message, stack } = error;
      this.setState({ hasError: true, message: message, stack: stack });
      const gameStatus = this.props.GameStatus
      this.props.io.emit("Error", {
          message: message,
          stack: stack,
          info: info,
          gameStaus: gameStatus
      });
    }
  
    render() {
        const props = this.props;
      if (this.state.hasError) {
          const FallBackUI = this.props.fallBackUI;
        return <div className="container">
            <h1 className="header">Aw, Snap! Something went wrong</h1>
            <span className="error">(Geeky Details) Message: {this.state.message}</span>
            <span className="error">(Geeky Details) Stack: {this.state.stack}</span>
            {FallBackUI && 
            <div className="container">
                <FallBackUI GameStatus={props.GameStatus} onGameStatusChange={props.onGameStatusChange} io={props.io}></FallBackUI>
            </div>}
        </div>;
      }
      return this.props.children;
    }
  }

class Client extends React.Component{
    constructor(props) {
        super(props);
        this.state = {
            playerId: -1,
            players: [],
            myInfo: {},
            state: "Outside",
            // Only available in Gaming state
            gameInfo: {
                Events: []
            },
            selectedCard: false,
            selectedCardIdx: -1,
            targetedPlayerId: -1,
            AccioChoose: false,
            passedTurn: false,
            lastSeenEventIdx: 0
        };
        this.io = io('');
    }
    componentDidMount() {
        this.setRemoteUpdateCallback();
    }
    setRemoteUpdateCallback(){
        this.io.on("id", (id) => {
            this.setState((state, props) => {
                state.playerId = id;
                return state;
            });
        });
        this.io.on("roomInfo",(info) => {
            this.setState((state, props) => {
                state.players = info.players;
                return state;
            });
        });
        
        this.io.on("AccioChoose",() =>{
            this.setState((state, props) => {
                state.AccioChoose = true;
                return state;
            });
        });

        this.io.on("Start",() =>{
            this.setState((state, props) => {
                state.state = "Gaming";
                return state;
            });
        });
        this.io.on("gameInfo",(info) => {
            this.setState((state, props) => {
                if (state.state !== 'Gaming') {
                    state.state = 'Gaming'
                }
                state.gameInfo = info;
                return state;
            });
        });
        this.io.on("gameEnd",()=>{
            this.setState((state, props) => {
                state.state = "GamingEnded";
                return state;
            }); 
        });
        this.io.on("restartRound",(restartInfo)=> {
            window.alert(restartInfo);
        });
    }
    componentWillUnmount() {
        this.io = null;
    }
    onGameStatusChange(updatedField, updatedValue) {
        this.setState((state, props) => {
            state[updatedField] = updatedValue;
            return state;
        });
    }
    onGameStatusMultiChange(changes) {
        this.setState((state, props) => {
            Object.keys(changes).forEach(updatedField => {
                state[updatedField] = changes[updatedField];
            });
            return state;
        });
        
    }
    render(){
        const iOS = !!navigator.platform && /iPad|iPhone/.test(navigator.platform);
        if(this.state.state=="Outside"){
            return (<div className="GameViewWrapper container">
                <img className="Logo" src={logo} alt="Logo" />
                {!iOS && <button className="Button" onClick={(e) => {
                    var ID = window.prompt("Please input the room ID (number) you want to join", "");
                    var rid = parseInt(ID);
                    if (isNaN(rid) || rid < 0) {
                        return;
                    }
                    this.io.emit("join", rid);
                    this.setState((state, props) => {
                        state.state = "InRoom";
                        return state;
                    });
                }}>Join</button>}
                {iOS && <div className="header">Sorry, this game is currently unavailable for iOS devices</div>}
            </div>); 
        }
        else if(this.state.state=="InRoom"){
            return (<RoomView GameStatus={this.state} io = {this.io}/>);
        }
        else{
            return (<GameView GameStatus={this.state}
                 io = {this.io} 
                 onGameStatusChange={this.onGameStatusChange.bind(this)}
                 onGameStatusMultiChange={this.onGameStatusMultiChange.bind(this)}/>);
        }
    }
}

function RoomView(props){
    return (
        <div>
            <RoomOperateArea name={props.GameStatus.myInfo.playerName} timelimit={props.GameStatus.timelimit}
                         isMaster={props.GameStatus.myInfo.isRoomMaster} isReady={props.GameStatus.myInfo.isReady4Gaming} io = {props.io}/>
            <PlayersArea players={props.GameStatus.players}/>
            <div className="container" align="center">
                <div className="Button" onClick={
                    (e) => {
                        props.io.emit("Start", "");
                    }
                }>
                    Start</div>
            </div>
        </div>
    );
}

function PlayersArea(props){
    console.log('players: ' + JSON.stringify(props.players, null, 2));
    const playersItems = _.map(props.players, (p,i) => 
        {
            return (
                <div className="row">
                    <li className="Option col">
                        {p.playerName + (p.isRoomMaster ? ' (Admin)' : '')}
                    </li>
                    <div className="gamingStatus col">{p.isReady4Gaming ? 'READY' : 'AWAITING'}</div>
                </div>
            );
        });
    return (<div className="container OptionList PlayersArea">
        <div className="header large">JOINED PLAYERS: {props.players.length}</div>
        {playersItems}
    </div>);
}

function RoomOperateArea(props){
    return (<div className="container RoomArea">
        <ConfigurationArea name={props.name} timelimit={props.timelimit} io={props.io}/>
            </div>);
}

class EditConfigurationEntry extends React.Component{
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
    }
    keyCallback(e){
        if(e.keyCode=="13"){
            e.preventDefault();
		}
    }
    handleChange(e){
        this.props.onValueChange(e.target.value);
    }
    render() {
        const propValue = this.props.propValue;
        return (<div className="row">
            <span className="col playerName">{this.props.propName}：</span>
            <input className="Box col" onKeyDown={this.keyCallback} onChange={this.handleChange} value={propValue}/>
        </div>);
    }
}

class ClickConfigurationEntry extends React.Component{
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
    }
    handleChange(e) {
        e.preventDefault();
        this.props.onValueChange(e.target.value);
    }
    render() {
        return (<div className="Conf">
            <span>{this.props.propName}：</span>
            <input className="Box" onClick={this.handleChange} value={this.props.propValue} readOnly="readonly"/>
        </div>);
    }
}

function ConfigurationArea(props){
    return (<div className="container">
        <EditConfigurationEntry propName="Player Name" propValue={props.name} onValueChange={(v) => props.io.emit("changeName",v)}/>
    </div>);
}

function GameView(props){
    return (
        <div className="container-fluid">
            {props.GameStatus.gameInfo.GameEnded && <WinnerArea winnerInfo={props.GameStatus.gameInfo}/>}
            {
                ["Gaming", "GamingEnded"].includes(props.GameStatus.state) &&
                <ErrorBoundary io={props.io} GameStatus={props.GameStatus} onGameStatusChange={props.onGameStatusChange} fallBackUI={ResultOperationArea}>
                    <ResultArea io={props.io} GameStatus={props.GameStatus} onGameStatusChange={props.onGameStatusChange} onGameStatusMultiChange={props.onGameStatusMultiChange}/>
                </ErrorBoundary>
            }
        </div>
    );
}

function WinnerArea(props){
    var winMessage = '';
    if (props.winnerInfo.GoodForceWins) {
        winMessage = 'Good Force Wins!'
    }
    else if (props.winnerInfo.EvilForceWins) {
        winMessage = 'Evil Force Wins!';
    }
    else {
        winMessage = 'Damn, Peter Wins!'
    }
    return (
    <div className="winnerWrapper">
        <img className="winnerTrophy"></img>
        <div className="winner">
            <div>
                {winMessage}
            </div>
        </div>
    </div>
    );
}

function getPlayerName(p, selfPlayerId) {
    var name = p.Character.revealed ? p.Character.name : '';
    if (p.ID === selfPlayerId) {
        name = p.Character.name + ' (You)'
    }
    else {
        if (p.isBot) {
            name = name ? name + ' (bot)' : `Player ${p.ID}` + ' (bot)'
        }
        else {
            name = name ? name + ` (${p.name})` : `Player ${p.ID}` + ` (${p.name})`
        }
    }
    return name;
}

function getPlayersTable(props) {
    const players = props.GameStatus.gameInfo.Players,
    selfPlayerId = props.GameStatus.playerId;
    return (
        <table className="table Results">
            <thead>
            <tr>
                <th>NO.</th><th>NAME</th><th>HORCRUXES</th><th>HAND CARDS</th><th>FACE UP CARDS</th>
            </tr>
            </thead>
            <tbody>
            {_.map(players, (p, idx) => {
                const number = idx + 1;
                const name = getPlayerName(p, selfPlayerId);
                return (
                    <tr>
                        <td>{number}</td>
                        <td>
                            <div className="OptionWrapper">
                                <div className="Option" onClick={() => {
                                    if (props.GameStatus.selectedCard) {
                                        props.onGameStatusChange('targetedPlayerId', p.ID);
                                    }
                                }}>
                                    {name}
                                </div>
                            </div>
                        </td>
                        <td>{p.HorcruxCount}</td>
                        <td>{'x ' + p.Hand.length}</td>
                        <td>{p.FaceUpCards.map(c => getCardName(c)).join(',')}</td>
                    </tr>
                );
            })}
            </tbody>
        </table>
    );
}

function getEvents(props) {
    const events = props.GameStatus.gameInfo.Events.length ? props.GameStatus.gameInfo.Events.slice(props.GameStatus.lastSeenEventIdx) : props.GameStatus.gameInfo.Events,
    selfPlayerName = 'Player ' + props.GameStatus.playerId,
    transformedEvents = events.map(e => e.replace(selfPlayerName, 'You')),
    currPlayerTurnID = props.GameStatus.gameInfo.currPlayerTurnID,
    currPlayerIsBot = props.GameStatus.gameInfo.Players.find(p => p.ID === currPlayerTurnID).isBot;
    return (
        <div className="container">
        <table className="table Results">
            <thead>
            <tr>
                <th>EVENTS</th>
            </tr>
            </thead>
            <tbody>
            {_.map(transformedEvents, (e, idx) => {
                const number = idx + 1;
                return (
                    <tr>
                        <td>{number}</td>
                        <td>
                            {e}
                        </td>
                    </tr>
                );
            })}
            </tbody>
        </table>
        {currPlayerIsBot && (
            <div className="col" id="playBotTurn">
                <button className="Action" onClick={(e) => {
                    props.io.emit("PlayBotTurn");
                    props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: false, lastSeenEventIdx: lastSeenEventIdx});
                }}>PLAY BOT TURN</button>
            </div>
        )}
        </div>
    );
}

function ResultOperationArea(props) {
    return (
        <div>
            {!props.GameStatus.isReady4NextRound && <div className="NextRoundButtonWrapper"><button className="Button" onClick = {(e) =>{
                props.io.emit("NextRound",'');
                props.onGameStatusChange('isReady4NextRound', true);
            }}>Next Round</button></div>}
            {props.GameStatus.state === "GamingEnded" && props.GameStatus.myInfo.isRoomMaster && !props.GameStatus.isReady4NextRound && 
            <button className="Button" onClick = {(e) =>{
                props.io.emit("Restart",'');
            }}>Restart</button>}
            {props.GameStatus.state === "GamingEnded" && <div>Game Ended. Waiting for admin to restart</div>}
            {props.GameStatus.state !== "GamingEnded" && props.GameStatus.isReady4NextRound && <div>Ready. Waiting for others</div>}
        </div>
    );
}

function getCardName(card) {
    switch(card.type) {
        case CardTypes.EXPELLIARMUS:
        case CardTypes.ACCIO:
        case CardTypes.AVADAKEDAVRA:
        case CardTypes.PROTEGO:
            return card.type
        case CardTypes.CB:
            return card.type + ' ' + card.number
        case CardTypes.CFC:
            return card.type + ' ' + card.suite + ' ' + card.number
        case CardTypes.DH:
            return card.suite
    }
}

function getCards(props) {
    const player = props.GameStatus.gameInfo.Players.find(p => p.ID === props.GameStatus.playerId),
    cards = player.Hand;
    const currPlayerTurnID = props.GameStatus.gameInfo.currPlayerTurnID,
    isCurrentTurn = currPlayerTurnID === player.ID,
    attackingCardTypes = [CardTypes.EXPELLIARMUS, CardTypes.ACCIO, CardTypes.AVADAKEDAVRA],
    shouldDiscardExcessCards = isCurrentTurn && player.Hand.length > 5;;
    return (
        <div className="row">
            {cards.map((c, idx) => {
                const className = idx === 0 ? "col-md-5" : "col-md-5 col-md-offset-2";
                return (
                    <div className={className}>
                    <div className="OptionWrapper">
                        <li className="Option" onClick={() => {
                            if (isCurrentTurn && attackingCardTypes.includes(c.type)) {
                                props.onGameStatusChange('selectedCard', c);
                            }
                            else if (isCurrentTurn && shouldDiscardExcessCards) {
                                props.onGameStatusChange('selectedCard', c);
                            }
                        }}>
                            {getCardName(c)}
                        </li>
                    </div>
                    </div>
                );
            })}
        </div>
    );
}

function getNumbersSummingToTarget(targetSum, reqNumbers, sortedArray, fromIdx, result) {
    if (fromIdx === sortedArray.length) {
        return [false];
    }
    if (reqNumbers === 1) {
      if (sortedArray.slice(fromIdx, sortedArray.length).includes(targetSum)) {
        return [true, result.concat(targetSum)];
      } else {
        return [false];
      }
    } 
    const results = [];
    for (let i = fromIdx; i < sortedArray.length; i++) {
      results.push(getNumbersSummingToTarget(targetSum - sortedArray[i], reqNumbers - 1, sortedArray, i + 1, result.concat(sortedArray[i])));
    }
    const hasSum = results.find(r => r[0]);
    if (hasSum) {
      return hasSum;
    }
    return [false];
  }

  function hasCombination(HandCards, count) {
    const cfcCards = HandCards.filter(c => c.type === CardTypes.CFC),
    sortedCfcNumbers = cfcCards.map(c => c.number).sort((a, b) => a - b);
    for (let i = 1; i <= 3; i++) {
      const combination = getNumbersSummingToTarget(7, i, sortedCfcNumbers, 0, []);
      if (combination[0]) {
        return true;
      }
    }
    return false;
  }

  function deckHasHallowCards(gameInfo) {
    return gameInfo.DeathlyHallowDeck.length > 0;
  }

function getActions(props) {
    const player = props.GameStatus.gameInfo.Players.find(p => p.ID === props.GameStatus.playerId),
    currPlayerTurnID = props.GameStatus.gameInfo.currPlayerTurnID,
    isCurrentTurn = currPlayerTurnID === player.ID,
    currPlayerIsBot = props.GameStatus.gameInfo.Players.find(p => p.ID === currPlayerTurnID).isBot,
    selectedCard = props.GameStatus.selectedCard,
    isReadyToCast = selectedCard && props.GameStatus.targetedPlayerId !== -1,
    canPlayAsAK = player.FaceUpCards.some(c => c.type === 'DEATHLY-HALLOW' && c.suite === 'ELDER-WAND'),
    canActivateCB = player.Hand.some(c => c.type === CardTypes.CB) && !player.FaceUpCards.some(c => c.type === CardTypes.CB),
    canCastProtego = props.GameStatus.gameInfo.currTargetedPlayerTurnID === player.ID &&
                    player.Hand.some(c => c.type === CardTypes.PROTEGO),
    canPreDrawCard = isCurrentTurn && !props.GameStatus.gameInfo.preDrawnCard && player.Hand.length < 5,
    drawCardPostPass = props.GameStatus.passedTurn && !props.GameStatus.gameInfo.preDrawnCard,
    shouldDiscardExcessCards = isCurrentTurn && player.Hand.length > 5,
    lastSeenEventIdx = props.GameStatus.gameInfo.Events.length ? props.GameStatus.gameInfo.Events.length - 1: 0;
    // TODO: add hallow effect buttons , accio choose
    return (
        <div className="container" align="center">
            <div className="row">
            {isCurrentTurn && isReadyToCast && (
                <div className="col" id="attack">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("PlayAttackingCard", { card: selectedCard, playAsAK: false, targetedPlayerId: props.GameStatus.targetedPlayerId, passedTurn: false });
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1});
                    }}>{'CAST ' + props.GameStatus.selectedCard.type}</button>
                </div>
            )}
            {isCurrentTurn && !shouldDiscardExcessCards && (
                <div className="col" id="endTurn">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("EndTurn");
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: false, lastSeenEventIdx: lastSeenEventIdx});
                    }}>END TURN</button>
                </div>
            )}
            {isCurrentTurn && canActivateCB && (
                <div className="col" id="activateCB">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("ActivateCB");
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: false});
                    }}>{'ACTIVATE CRYSTAL BALL'}</button>
                </div>
            )}
            {canCastProtego && (
                <div className="col" id="castProtego">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("CastProtego");
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: false});
                    }}>{'CAST PROTEGO'}</button>
                </div>
            )}
            {(canPreDrawCard || drawCardPostPass) && (
                <div className="col" id="predrawCard">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("DrawCard");
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: false});
                    }}>{'DRAW CARD'}</button>
                </div>
            )}
            {isCurrentTurn && !shouldDiscardExcessCards && !props.GameStatus.passedTurn && (
                <div className="col" id="passTurn">
                    <button className="Action" onClick={(e) => {
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: true});
                    }}>{'PASS TURN'}</button>
                </div>
            )}
            {shouldDiscardExcessCards && selectedCard && (
                <div className="col" id="discardCard">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("DiscardCard", selectedCard);
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: false});
                    }}>{'DISCARD CARD'}</button>
                </div>
            )}
            {isCurrentTurn && hasCombination(player.Hand) && deckHasHallowCards(props.GameStatus.gameInfo) &&(
                <div className="col" id="getHallow">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("GetHallow");
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, passedTurn: false});
                    }}>{'GET HALLOW'}</button>
                </div>
            )}
            {props.GameStatus.AccioChoose && (
                <div className="col" id="accioRandom">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("AccioChosen", {chooseRandom: true});
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, AccioChoose: false, passedTurn: false});
                    }}>{'ACCIO RANDOM HAND CARD'}</button>
                </div>
            )}
            {props.GameStatus.AccioChoose && (
                <div className="col" id="accioFaceUp">
                    <button className="Action" onClick={(e) => {
                        props.io.emit("AccioChosen", {chooseRandom: false});
                        props.onGameStatusMultiChange({selectedCard: null, targetedPlayerId: -1, AccioChoose: false, passedTurn: false});
                    }}>{'ACCIO CRYSTAL BALL CARD'}</button>
                </div>
            )}
            </div>
        </div>
    );
}

function ResultArea(props) {
    const gameInfo = props.GameStatus.gameInfo,
    player = gameInfo.Players.find(p => p.ID === props.GameStatus.playerId),
    currPlayerTurnID = gameInfo.currPlayerTurnID,
    isCurrentTurn = currPlayerTurnID === player.ID,
    currTurnPlayer = gameInfo.Players.find(p => p.ID === currPlayerTurnID),
    turnMessage = 'Current Turn: ' + (isCurrentTurn ? 'Your' : getPlayerName(currTurnPlayer)),
    canCastProtego = props.GameStatus.gameInfo.currTargetedPlayerTurnID === player.ID &&
                    player.Hand.some(c => c.type === CardTypes.PROTEGO),
    selectedCard = props.GameStatus.selectedCard,
    isReadyToCast = selectedCard && props.GameStatus.targetedPlayerId !== -1,
    shouldDiscardExcessCards = isCurrentTurn && player.Hand.length > 5,
    excessCards = shouldDiscardExcessCards && (player.Hand.length - 5);
    
    return (
        <div className="ResultsWrapper container">
            <div className="header">{turnMessage}</div>
            {canCastProtego && <div className="header">Cast Protego or Pass(save up for later)</div>}
            {isReadyToCast && <div className="header">Select a player to cast the spell on</div>}
            {isCurrentTurn && !selectedCard && <div className="header">Select a card to cast a spell</div>}
    {shouldDiscardExcessCards && <div className="header">Discard{' ' + excessCards}{excessCards > 1 ? ' Cards' : ' Card'}</div>}
            <div className="row">
                <div className="col-7">{getPlayersTable(props)}</div>
                <div className="col-5">{getEvents(props)}</div>
            </div>
            {getCards(props)}
            {getActions(props)}
        </div>
    );
}

const domContainer = document.querySelector('#gameview');
ReactDOM.render(e(Client), domContainer);