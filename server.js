const config = require('config');
const express = require("express");
const axios = require('axios');
const myhelper = require('./mymodules/helper');
const game = require('./mymodules/game');
const querystring = require('node:querystring'); 
const app = express();
const port = 3000;

/*
let hostName='';
let hostid='';
var accessToken = '';
var playlist = [];
var playlistURL = '';
let password = myhelper.makeid(16)

var playerCount = 0;
var songsPerPerson = 5;
*/

var games = [];

var loggingIn = {}

var redirect_uri = 'http://192.168.1.70:3000/callback';

const client_id = config.get('client_id');
const client_secret = config.get('client_secret');

app.use(express.static("public"));
app.use(express.json());


async function getToken(code){
    const params = new URLSearchParams({ code: code, redirect_uri: redirect_uri,grant_type: 'authorization_code' });


    const response = await axios.post( 'https://accounts.spotify.com/api/token',params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
        }
      });
    accessToken = response.data.access_token;
    return accessToken
}

function getGameByGameID(gameid){
    let currentGame;
    let found = false;
    games.forEach((game) => {
        if (game.gameid == gameid){
            currentGame= game
            found = true
            return
        }
    })
    return {game:currentGame,found:found};
}

function getGameByPlayerID(playerID){
    let currentGame;
    let found = false;
    games.forEach((game) => {
        if (game.isPlayerInGame(playerID)){
            currentGame= game
            found = true
            return
        }
    })
    return {game:currentGame,found:found};
}


app.get("/", (req, res) => {
    let playerID = req.query.playerID
    if (playerID == null) {
        res.sendFile("./getplayerid.html", { root: __dirname+"/pages"});
        return
    }
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found) {
        res.sendFile("./index.html", { root: __dirname+"/pages"});
    }else{
        res.sendFile("./login.html", { root: __dirname+"/pages"});
    }
});

app.get("/getGames", (req, res) => {
    let livegames = {otherGames:[]};
    games.forEach((game) => {
        if (game.playlistURL=="") {
            if (game.isHost(req.query.playerID)) {
                livegames.yourGame = game;
            }else{
                livegames.otherGames.push(game);
            }
        }
    });
    res.send(livegames);
});

app.post("/joinGame", (req, res) => {
    let playerID = req.query.playerID
    let existingGame = getGameByPlayerID(playerID)
    if (existingGame.found) {
        existingGame.game.removePlayerFromGame(playerID)
    }

    let gameID = req.query.gameID

    let gameSearch = getGameByGameID(gameID)
    if (gameSearch.found) {
        gameSearch.game.addPlayerToGame(playerID)
        res.sendStatus(200);
    }else{
        res.sendStatus(404);
    }
})

app.post("/leaveGame", (req, res) => {
    let playerID = req.query.playerID
    let existingGame = getGameByPlayerID(playerID)
    if (existingGame.found) {
        existingGame.game.removePlayerFromGame(playerID)
        res.sendStatus(200);
    }else{
        res.sendStatus(404);
    }
})

app.post("/closeGame", (req, res) => {
    let playerID = req.query.playerID
    let existingGame = getGameByPlayerID(playerID)
    if (existingGame.found && existingGame.game.isHost(playerID)) {
        games.splice(games.indexOf(existingGame.game),1)
        res.sendStatus(200);
    }else{
        res.sendStatus(404);
    }
})

app.get('/login', async (req, res) =>{
    let playerID = req.query.playerID
    let songCount = req.query.songCount
    var state = myhelper.makeid(16);
    loggingIn[state] = {playerID:playerID,songCount:songCount}

    var scope = 'user-read-email user-read-private playlist-read-private playlist-modify-public playlist-modify-private';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state
        }));
});

app.get('/callback', async (req, res) => {

    var code = req.query.code || null;
    var state = req.query.state || null;
    if (state === null) {
        res.redirect('/#' +
            querystring.stringify({
            error: 'state_mismatch'
            }));
        return
    }
    let accessToken = await getToken(code)
    const response = await axios.get(`https://api.spotify.com/v1/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}` 
      }
    });

    let gameInfo = loggingIn[state]

    delete loggingIn[state]

    let newGame=  new game.game(gameInfo.playerID,response.data.id,response.data.display_name,accessToken,gameInfo.songCount)
    games.push(newGame)
    res.redirect(`/?playerID=${gameInfo.playerID}`);
});

// Endpoint to search for songs
app.get('/search', async (req, res) => {
    const { query } = req.query;
    try {
        const response = await axios.get(`https://api.spotify.com/v1/search`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                q: query,
                type: 'track',
                limit: 5
            }
        });
        res.json(response.data.tracks.items);
    } catch (error) {
        res.status(500).send('Error fetching data from Spotify');
    }
});


app.get("/loadinfo", (req, res) => {
    let isPlayerHost=false
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        res.send({
            validGame:false
        })
        return
    }

    res.send({
        validGame:true,
        hostName: gameSearch.game.hostName,
        isPlayerHost: gameSearch.game.isHost(playerID),
    });
});

app.get('/update', async (req, res) => {
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        var response = {
            validGame:false
        }
        res.json(response);
        return
    }
    res.json(gameSearch.game.update(playerID));
});

app.get('/remove', async (req, res) => {
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        return
    }

    var id = req.query["songID"];
    gameSearch.game.removeSong(playerID,id);
    res.sendStatus(200);
});

// Will be just for admin
app.post('/submit', async (req, res) => {
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        return
    }

    res.send(await gameSearch.game.submit(playerID));
});

// Will be just for admin
app.post('/clear', async (req, res) => {
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        return
    }

    gameSearch.game.clear(playerID);
    res.sendStatus(200);
});

// Endpoint to search for songs
app.post('/add', async (req, res) => {
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        return
    }

    var body = req.body;
    body.playerID = playerID
    res.send(gameSearch.game.addSong(body));
 });


 function tick(){
    games.forEach((game) => {
        console.log(game.expiresAt-Date.now())
        if (game.expiresAt < Date.now()){
            games.splice(games.indexOf(game),1)
        }
    });
}

setInterval(tick,30000);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});