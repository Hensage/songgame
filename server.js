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

function getGame(gameid){
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

app.get("/", (req, res) => {
    let currentGame = req.query.gameid
    let foundGame = false
    games.forEach((game) => {
        if (game.gameid == currentGame){
            res.sendFile("./index.html", { root: __dirname+"/pages"});
            foundGame =true
            return
        }
    })
    if (!foundGame) {
        res.sendFile("./login.html", { root: __dirname+"/pages"});
    }
});

app.get("/getGames", (req, res) => {
    res.send(games);
});

app.get('/login', async (req, res) =>{
    var state = myhelper.makeid(16);
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
    let newGame=  new game.game(response.data.id,response.data.display_name,accessToken,3)
    games.push(newGame)
    res.redirect('/?gameid='+newGame.gameid+'&p='+newGame.password);
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
    let gameid = req.query.gameid
    let gameSearch = getGame(gameid);

    if (gameSearch.found == false){
        return
    }

    let pass = req.query.p

    if (pass == gameSearch.game.password){
        isPlayerHost=true
    }
    res.send({
        hostName: gameSearch.game.hostName,
        isPlayerHost: isPlayerHost,
    });
});

app.get('/update', async (req, res) => {
    let gameid = req.query.gameid
    let gameSearch = getGame(gameid);

    if (!gameSearch.found){
        var response = {
            validGame:false
        }
        res.json(response);
        return
    }
    let playerID = req.query.playerID
    res.json(gameSearch.game.update(playerID));
});

app.get('/remove', async (req, res) => {
    let gameid = req.query.gameid
    let gameSearch = getGame(gameid);

    if (gameSearch.found == false){
        return
    }

    var id = req.query["songID"];
    gameSearch.game.removeSong(id);
    res.sendStatus(200);
});

// Will be just for admin
app.post('/submit', async (req, res) => {
    let gameid = req.query.gameid
    let gameSearch = getGame(gameid);

    if (gameSearch.found == false){
        return
    }

    let pass = req.query.p
    res.send(await gameSearch.game.submit(pass));
});

// Will be just for admin
app.post('/clear', async (req, res) => {
    let gameid = req.query.gameid
    let gameSearch = getGame(gameid);

    if (gameSearch.found == false){
        return
    }

    let pass = req.query.p
    gameSearch.game.clear(pass);
    res.sendStatus(200);
});

// Endpoint to search for songs
app.post('/add', async (req, res) => {
    let gameid = req.query.gameid
    let gameSearch = getGame(gameid);

    if (gameSearch.found == false){
        return
    }

    var body = req.body;
    res.send(gameSearch.game.addSong(body));
 });

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});