const config = require('config');
const express = require("express");
const axios = require('axios');
const myhelper = require('./mymodules/helper');
const game = require('./mymodules/game');
var fs = require('fs');
const querystring = require('node:querystring'); 
const c = require('config');
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
const volumePath = config.get("volumePath");

var games = [];
if (fs.existsSync(volumePath)){
    var data = JSON.parse(fs.readFileSync(volumePath));
    data.forEach((oldGame) => {
        let newGame= new game.game()
        newGame.constructFromOld(oldGame)
        games.push(newGame)
    });
}else{
    fs.writeFileSync(volumePath, JSON.stringify(games));
}

var loggingIn = {}

var redirect_uri = config.get("redirect_uri");
//var redirect_uri = 'http://192.168.1.163:3000/callback';

const client_id = config.get('client_id');
const client_secret = config.get('client_secret');
const stub = config.get("stub");

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

function fileWriteCallback(err, result){
    if (err) {
        console.log(err,result)
    }
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
        fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
    }

    let gameID = req.query.gameID

    let gameSearch = getGameByGameID(gameID)
    if (gameSearch.found) {
        gameSearch.game.addPlayerToGame(playerID)
        fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
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
        fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
        res.sendStatus(200);
    }else{
        res.sendStatus(404);
    }
})

app.post("/closeGame", (req, res) => {
    let playerID = req.query.playerID
    let existingGame = getGameByPlayerID(playerID)
    if (existingGame.found) {
        if (existingGame.game.isHost(playerID)){
            games.splice(games.indexOf(existingGame.game),1)
        }else{
            existingGame.game.removePlayerFromGame(playerID)
        }
        fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
        res.sendStatus(200);
    }else{
        res.sendStatus(404);
    }
})

app.get('/login', async (req, res) =>{
    let playerID = req.query.playerID
    let songCount = req.query.songCount
    let era = req.query.era
    var state = myhelper.makeid(16);
    loggingIn[state] = {playerID:playerID,songCount:songCount,era:era}

    var scope = 'user-read-email user-read-private playlist-read-private playlist-modify-public playlist-modify-private';
    if (stub){
        res.redirect(redirect_uri+"?state="+state);
    }else{
        res.redirect('https://accounts.spotify.com/authorize?' +
            querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
            }));
    }

});

app.get('/callback', async (req, res) => {
    let newGame;
    var code = req.query.code || null;
    var state = req.query.state || null;
    let gameInfo = loggingIn[state]
    delete loggingIn[state]
    if (!stub){
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

        newGame=  new game.game()
        newGame.construct(gameInfo.playerID,response.data.id,response.data.display_name,accessToken,gameInfo.songCount,gameInfo.era)
    }else{
        newGame=  new game.game()
        newGame.construct(gameInfo.playerID,myhelper.makeid(16),"STUBACCOUNT","TOKEN",gameInfo.songCount,gameInfo.era)
        
    }
    //console.log(newGame)
    games.push(newGame)
    //console.log(games)
    fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
    res.redirect(`/?playerID=${gameInfo.playerID}`);
});

// Endpoint to search for songs
app.get('/search', async (req, res) => {
    const { query } = req.query;
    if (query.length<1){
        res.status(405).send('No query provided');
        return
    }
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)
    if (gameSearch.found == false){
        res.send({
            validGame:false
        })
        return
    }
    try {
        var finalQ = `year:`+gameSearch.game.era+` "`+query+`"`
        if (stub){
            let data = JSON.parse(fs.readFileSync("./stubdata/search.json"))
            res.json(data.tracks.items);
        }else{
            const response = await axios.get(`https://api.spotify.com/v1/search`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                params: {
                    q: finalQ,
                    type: 'track',
                    limit: 5
                }
            });
            res.json(response.data.tracks.items);
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching data from Spotify');
    }
});


app.get("/loadinfo", (req, res) => {
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
        songsPerPerson: gameSearch.game.songsPerPerson
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
    fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
    res.sendStatus(200);
});

// Will be just for admin
app.post('/submit', async (req, res) => {
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        return
    }
    let output = await gameSearch.game.submit(playerID,stub)
    fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
    res.send(output);
});

// Will be just for admin
app.post('/clear', async (req, res) => {
    let playerID = req.query.playerID
    let gameSearch = getGameByPlayerID(playerID)

    if (gameSearch.found == false){
        return
    }

    gameSearch.game.clear(playerID);
    fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
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
    let output = gameSearch.game.addSong(body)
    fs.writeFile(volumePath, JSON.stringify(games),fileWriteCallback);
    res.send(output);
 });


 function tick(){
    games.forEach((game) => {
        if (game.expiresAt < Date.now()){
            games.splice(games.indexOf(game),1)
        }
    });
}
tick();
setInterval(tick,30000);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});