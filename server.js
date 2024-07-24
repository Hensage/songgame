const config = require('config');
const express = require("express");
const axios = require('axios');
const myhelper = require('./mymodules/helper');
const querystring = require('node:querystring'); 
const app = express();
const port = 3000;

let hostName='';
let hostid='';
var accessToken = '';
var playlist = [];
var playlistURL = '';
let password = myhelper.makeid(16)

var playerCount = 0;
var songsPerPerson = 5;

var redirect_uri = 'http://192.168.1.70:3000/callback';

const client_id = config.get('client_id');
const client_secret = config.get('client_secret');

app.use(express.static("public"));
app.use(express.json());

async function createPlaylist(){
    const response = await axios.post(`https://api.spotify.com/v1/users/`+hostid+`/playlists`,
        {
            name:"Song Game",
            description:"A party game where you all put 3 songs into a spotify playlist",
            public:true
        }, 
        {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        
        });
        return response;
}

async function addToPlaylist(id,uris){
    const response = await axios.post(`https://api.spotify.com/v1/playlists/`+id+`/tracks?position=0&uris=`+uris,{}, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
        });
}

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

function getSongCountForPlayer(playerID){
    var count =0
    playlist.forEach((song) => {
        if (playerID === song.playerID) {
            count++
        }
    })
    return count
}

function tick(){
    let ids = []
    playlist.forEach((song) => {
        if (!ids.includes(song.playerID)){
            ids.push(song.playerID)
        }
    })
    playerCount = ids.length
}

app.get("/", (req, res) => {
    if (hostid === '') {
        res.sendFile("./login.html", { root: __dirname+"/pages"});
    }else{
        res.sendFile("./index.html", { root: __dirname+"/pages"});
    }
});

app.get("/loadinfo", (req, res) => {
    let isPlayerHost=false
    let pass = req.query.p
    console.log(pass,password)
    if (pass == password){
        isPlayerHost=true
    }
    res.send({
        hostName: hostName,
        isPlayerHost: isPlayerHost,
    });
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
    accessToken = await getToken(code)
    const response = await axios.get(`https://api.spotify.com/v1/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    hostName = response.data.display_name
    hostid = response.data.id
    res.redirect('/?p='+password);
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

app.get('/update', async (req, res) => {
    playing = false
    if (playlistURL == '') {
        playing=true
        var id = req.query["playerID"];

        var theirSong = []
        playlist.forEach((song) => {
            if (id === song.playerID) {
                theirSong.push(song);
            }
        })
    }
    var response = {
        isPlaying:playing,
        playerCount:playerCount,
        songsPerPerson:songsPerPerson,
        count:playlist.length,
        items:theirSong
    }
    res.json(response);
});

app.get('/remove', async (req, res) => {
    var id = req.query["songID"];
    playlist.forEach((song,index) => {
        if (id === song.id) {
            playlist.splice(index,1)
        }
    })
    res.sendStatus(200);
});

// Will be just for admin
app.post('/submit', async (req, res) => {
    var playlistData = await createPlaylist()
    if (playlist.length>0){
        var query = ""
        myhelper.shuffle(playlist)
        playlist.forEach((song)=>{
            query = query+","+song.uri
        })
        query = query.slice(1)
    }
    await addToPlaylist(playlistData.data.id,query)
    playlist=[]
    playlistURL = playlistData.data.external_urls.spotify
    res.send(playlistURL);
});

// Will be just for admin
app.post('/clear', async (req, res) => {
    let pass = req.query.p
    console.log(pass,password)
    if (pass == password){
        playlist =[]
    }
    res.sendStatus(200);
});

// Endpoint to search for songs
app.post('/add', async (req, res) => {
    var body = req.body;
    var exists = false
    playlist.forEach((song) => {
        if (song.id === body.id) {
            exists = true;
            return;
        }
    })
    if (getSongCountForPlayer(body.playerID) >= songsPerPerson){
        res.send("You have already added all your songs");
        return
    }
    if (exists){
        res.send("This song is already in the playlist");
        return
    }else{
        playlist.push(body);
        res.send("Added");
        return
    }
 });

setInterval(tick,1000);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});