'use strict';

const e = React.createElement;
import _ from 'lodash';
import pyschLogo from './images/psych.jpg'
import adultsOnlyLogo from './images/adults-only.jpg'
import animalsLogo from './images/animals.jpg'
import darkStormyLogo from './images/dark-stormy.jpg'
import factLogo from './images/fact.jpg'
import itsTheLawLogo from './images/its-the-law.jpg'
import movieBluffLogo from './images/movie-bluff.jpg'
import nameThatShowLogo from './images/name-that-show.jpg'
import poetryLogo from './images/poetry.jpg'
import proverbsLogo from './images/proverbs.jpg'
import sayMyNameLogo from './images/say-my-name.jpg'
import thePlotThickensLogo from './images/the-plot-thickens.jpg'
import wordUpSwitcherooLogo from './images/word-up-switcheroo.jpg'
import wordUpLogo from './images/word-up.jpg'

const categoryImages = {
    "adults-only": adultsOnlyLogo,
    "animals": animalsLogo,
    "dark-stormy": darkStormyLogo,
    "fact": factLogo,
    "its-the-law": itsTheLawLogo,
    "movie-bluff": movieBluffLogo,
    "name-that-show": nameThatShowLogo,
    "poetry": poetryLogo,
    "proverbs": proverbsLogo,
    "say-my-name": sayMyNameLogo,
    "the-plot-thickens": thePlotThickensLogo,
    "word-up-switcheroo": wordUpSwitcherooLogo,
    "word-up": wordUpLogo
},
categories = Object.keys(categoryImages),
categoryDismissed = _.reduce(categories, (acc, category) => {
    acc[category + 'Dismissed'] = false;
    return acc;
}, {});

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
        this.state = _.assign({
            playerId: -1,
            myInfo: {},
            state: "Outside",
            timelimit: 180,
            playersInfo: [],
            // Only available in Gaming state
            word: "",
            clue: "",
            category: "",
            currResponse: "",
            responseSubmitted: false,
            isVotingPhase: false,
            voted: false,
            votingOptions: [],
            currVote: null,
            results: [],
            isReady4NextRound: false,
            numberOfRounds: -1,
            currRound: -1,
            awaitingResponders: [],
            awaitingVoters: [],
            selfVoted: false,
            time: -1,
            correct: 0,
            skip: 0
        }, categoryDismissed);
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
                state.timelimit = info.timelimit;
                state.playersInfo = info.players;
                for(var i=0;i<info.players.length;i++){
                    var player = info.players[i];
                    if(player.playerID === state.playerId){
                        state.myInfo=player;
                        state.state=player.state;
                    }
                }
                return state;
            });
        });
        
        this.io.on("wordToGuess",(word) =>{
            this.setState((state, props) => {
                state.word = word;
                return state;
            });
        });
        
        this.io.on("clueInfo",(clueInfo) =>{
            this.setState((state, props) => {
                state.clue = clueInfo.clue;
                state.category = clueInfo.category;
                state.currResponse = "";
                state.responseSubmitted = false;
                state.isReady4NextRound = false;
                state.currVote = null;
                state.results = [];
                state.voted = false;
                state.isVotingPhase = false;
                state.votingOptions = [];
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
                state.winnerNames = info.winnerNames;
                state.numberOfRounds = info.numberOfRounds;
                state.currRound = info.currRound;
                state.awaitingResponders = info.awaitingResponders;
                state.awaitingVoters = info.awaitingVoters;
                return state;
            });
        });
        this.io.on("votingOptions",(votingOptions) => {
            this.setState((state, props) => {
                state.votingOptions = votingOptions;
                state.isVotingPhase = true;
                return state;
            });
        });
        this.io.on("Results",(results) => {
            this.setState((state, props) => {
                state.results = results;
                state.state = "Results";
                state.isVotingPhase = false;
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
        })
        this.io.on("InProgressGameInfo",(info) => {
            this.setState((state, props) => {
                state.numberOfRounds = info.numberOfRounds;
                state.currRound = info.currRound;
                return state;
            });
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
                <img className="PsychLogo" src={pyschLogo} alt="Logo" />
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
                <div className="HowToPlay">How To Play:</div>
                <iframe src='https://www.youtube.com/embed/qu4ttGfTpOg'
                frameBorder='0'
                allow='autoplay; encrypted-media'
                allowFullScreen
                title='video'
                />
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
            <PlayersArea players={props.GameStatus.playersInfo}/>
            <div className="container" align="center">
                <div className="Button" onClick={
                    (e) => {
                        if (props.GameStatus.myInfo.isRoomMaster) {
                            props.io.emit("Start", "");
                        }
                        else {
                            if (props.GameStatus.myInfo.isReady4Gaming) {
                                props.io.emit("Unready", "");
                            }
                            else {
                                props.io.emit("Ready", "");
                            }
                        }
                    }
                }>
                    {
                        (props.GameStatus.myInfo.isRoomMaster ? "Start" :
                            (props.GameStatus.myInfo.isReady4Gaming ? "Cancel" : "Ready"))
                    }</div>
            </div>
        </div>
    );
}

function PlayersArea(props){
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
    const categoryDismissKey = props.GameStatus.category + 'Dismissed',
    categoryDismissed = props.GameStatus[categoryDismissKey],
    showModal = props.GameStatus.state === 'Gaming' && !categoryDismissed,
    modalClassName = showModal ? 'modal-show' : 'modal',
    display = showModal ? 'block' : 'none';
    return (
        <div className="container-fluid">
            <div className={modalClassName} tabIndex="-1" role="dialog">
                <div className="modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-body">
                            <button 
                                type="button" 
                                className="close" 
                                aria-label="Close" 
                                style={{display: display}}
                                onClick={() => {props.onGameStatusChange(categoryDismissKey, true)}}>
                                <span aria-hidden="true">&times;</span>
                            </button>
                            <div>
                                <img className={"categoryImage container"} src={categoryImages[props.GameStatus.category]} alt={props.GameStatus.category} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {["Gaming", "Results"].includes(props.GameStatus.state) 
                && <ClueArea 
                        clue={props.GameStatus.clue} 
                        category={props.GameStatus.category} 
                        state={props.GameStatus.state}
                        currRound={props.GameStatus.currRound}
                        numberOfRounds={props.GameStatus.numberOfRounds}
                    />}
            {props.GameStatus.state === "GamingEnded" && <WinnerArea winnerNames={props.GameStatus.winnerNames}/>}
            {props.GameStatus.state === "Gaming" &&
                <GameOperationArea io={props.io}
                 GameStatus={props.GameStatus} 
                 onGameStatusChange={props.onGameStatusChange}
                 onGameStatusMultiChange={props.onGameStatusMultiChange}/>
            }
            {
                ["Results", "GamingEnded"].includes(props.GameStatus.state) &&
                <ErrorBoundary io={props.io} GameStatus={props.GameStatus} onGameStatusChange={props.onGameStatusChange} fallBackUI={ResultOperationArea}>
                    <ResultArea io={props.io} GameStatus={props.GameStatus} onGameStatusChange={props.onGameStatusChange}/>
                </ErrorBoundary>
            }
        </div>
    );
}


function ClueArea(props){
    return (
    <div className="container-fluid">
        <div className="header container">
            <div className="row">
                <div className="col">
                    {"ROUND " + props.currRound + "/" + props.numberOfRounds}
                </div>
                <div className="col">{"CATEGORY: " + props.category}</div>
            </div>
        </div>
        {/* <div>
        <img className={"categoryImage container"} src={categoryImages[props.category]} alt={props.category} />
        </div> */}
        <div className={"clue"}>
            {props.clue}
        </div>
    </div>);
}

function WinnerArea(props){
    return (
    <div className="winnerWrapper">
        <img className="winnerTrophy"></img>
        <div className="winner">
            <div>{props.winnerNames && props.winnerNames.length === 1 ? 'WINNER: ' + props.winnerNames : 'WINNERS (TIED): ' + props.winnerNames}
            </div>
        </div>
    </div>
    );
}

function GameOperationArea(props){
    const selfAnswer = props.GameStatus.votingOptions.find(v => v.playerID === props.GameStatus.playerId);
    var errorMsg = '';
    return (
        <div className="GameArea container">
            {!props.GameStatus.responseSubmitted && 
            <form onSubmit={e => {
                props.io.emit("Response", props.GameStatus.currResponse);
                props.onGameStatusChange('responseSubmitted', true);
            }}>
                <p>Your response:</p>
                <input
                    type='text'
                    onChange={(e) => {
                        props.onGameStatusChange('currResponse', e.target.value);
                    }}
                />
                <button className="Button" type="submit" disabled={!props.GameStatus.currResponse}>Submit</button>
            </form>}
            {
                !props.GameStatus.isVotingPhase && props.GameStatus.responseSubmitted && <div>Submitted Response. Waiting for {props.GameStatus.awaitingResponders.join(" , ")}</div>
            }
            {
                props.GameStatus.isVotingPhase &&
                !props.GameStatus.voted &&
                <div className="container">
                        <div className="header container">
                            ANSWERS
                        </div>
                        <ul className="OptionList">
                        {_.reduce(props.GameStatus.votingOptions, (acc, v) => {
                            acc.push((
                                <div className="OptionWrapper">
                                    <li className="Option" onClick={() => {
                                    if (v.option === selfAnswer.option) {
                                        props.onGameStatusChange('selfVoted', true);
                                    }
                                    else {
                                        props.io.emit("Vote", v.option);
                                        props.onGameStatusMultiChange({selfVoted: false, voted: true});
                                    }
                                    
                                    }}>
                                    {v.option}
                                </li>
                                {props.GameStatus.selfVoted && v.option === selfAnswer.option &&<span className="errorMsg">Cannot vote self answer!</span>}
                                </div>
                            ));
                            return acc;
                        }, [])}
                        </ul>
                </div>
            }
            {
                props.GameStatus.isVotingPhase && props.GameStatus.voted && <div>Voted. Waiting for {props.GameStatus.awaitingVoters.join(" , ")}</div>
            }
        </div>);
}

function getSpookedPlayerNames(playersInfo, response, spooks)  {
    const spookRes = _.find(spooks, s => s.response === response),
    spookedPlayerIds = spookRes ? spookRes.SPOOKED_PLAYER_IDS : null,
    spookedPlayerNames = spookedPlayerIds.length ? _.map(spookedPlayerIds, id => {
        const player = _.find(playersInfo, p => p.playerID === id);
        return player ? player.playerName : null;
    }) : [];
    return spookedPlayerNames;
}

function getPlayersOrderedByScore(pInfo) {
    const playersInfo = JSON.parse(JSON.stringify(pInfo));
    return _.orderBy(playersInfo, ['score'], ['desc']);
}

function getResultsTable(players) {
    return (
        <table className="table Results">
            <tr>
                <th>RANK</th><th>NAME</th><th>POINTS</th>
            </tr>
            {_.map(players, (p, idx) => {
                const rank = idx + 1;
                return (
                    <tr>
                        <td>{rank}</td>
                        <td>{p.playerName}</td>
                        <td>{p.score}</td>
                    </tr>
                );
            })}
        </table>
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

function ResultArea(props) {
    const results = props.GameStatus.results,
    playersInfo = props.GameStatus.playersInfo,
    answeredCorrectly = results.correctAnswererPlayerIds.includes(props.GameStatus.playerId),
    spookedPlayers = _.find(results.spooks, s => s.SPOOKER_PLAYER_ID === props.GameStatus.playerId),
    spookedPlayerNames = spookedPlayers ? spookedPlayers.SPOOKED_PLAYER_NAMES : [],
    spookedMsg = 'You spooked ' + (spookedPlayerNames.length ? spookedPlayerNames : 'None'),
    spookerPlayer = !answeredCorrectly ? _.find(results.spooks, s => s.SPOOKED_PLAYER_IDS.includes(props.GameStatus.playerId)) : null,
    spookedByPlayerName = spookerPlayer ? spookerPlayer.SPOOKER_PLAYER_NAME: null,
    spookedByMsg = spookedByPlayerName ? spookedByPlayerName + ' spooked you' : null;
    
    return (
        <div className="ResultsWrapper container">
            {answeredCorrectly && <div className="header pad-down">You answered correctly</div>}
            {!answeredCorrectly && <div className="header pad-down">{spookedByMsg}</div>}
            {<div className="header pad-down">{spookedMsg}</div>}
            <div className="header">HOW MANY TIMES WAS EACH ANSWER PICKED ?</div>
            <ul className="OptionList">
                {[
                    (
                        <div className="OptionWrapper">
                            <div className="row">
                                <li className="Option Correct col">
                                    {'(correct answer) ' + results.correctAnswer}
                                </li>
                                <div className="voteCount col">{results.correctAnswererPlayerIds.length}</div>
                            </div>
                        </div>
                    )
                ].concat(_.reduce(results.spooks, (acc, option) => {
                    acc.push((
                        <div className="OptionWrapper">
                            <div className="row">
                                <li className="Option col">
                                    {option.response}
                                </li>
                                <div className="voteCount col">{option.SPOOKED_PLAYER_IDS.length}</div>
                            </div>
                        </div>
                    ));
                    return acc;
                }, []))}
            </ul>
            <div className="header">RESULTS</div>
            {getResultsTable(getPlayersOrderedByScore(playersInfo))}
            <ResultOperationArea GameStatus={props.GameStatus} onGameStatusChange={props.onGameStatusChange} io={props.io}></ResultOperationArea>
        </div>
    );
}

const domContainer = document.querySelector('#gameview');
ReactDOM.render(e(Client), domContainer);