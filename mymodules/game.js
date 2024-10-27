
const myhelper = require('./helper');
const axios = require('axios');

class game{
    constructor(){}
    construct(hostPlayerID,hostid,hostName,accessToken,songsPerPerson){
        this.playlist = [];
        this.players = [];
        this.playerCount = 0;
        this.playlistURL = '';
        this.expiresAt = Date.now() + 1000*60*59;

        this.gameid = myhelper.makeid(16);
        this.hostPlayerID = hostPlayerID;
        this.addPlayerToGame(hostPlayerID);
        this.hostid=hostid;
        this.hostName=hostName;
        this.accessToken=accessToken;
        this.songsPerPerson= songsPerPerson;
        this.password = myhelper.makeid(16);
        setInterval(this.tick.bind(this),1000);
    }
    constructFromOld(oldGame){
        this.playlist = oldGame.playlist;
        this.players = oldGame.players;
        this.playerCount = oldGame.playerCount;
        this.playlistURL = oldGame.playlistURL;
        this.expiresAt = oldGame.expiresAt;

        this.gameid = oldGame.gameid;
        this.hostPlayerID = oldGame.hostPlayerID;
        this.hostid=oldGame.hostid;
        this.hostName=oldGame.hostName;
        this.accessToken=oldGame.accessToken;
        this.songsPerPerson= oldGame.songsPerPerson;
        this.password = oldGame.password;
        setInterval(this.tick.bind(this),1000);
    }

    async createPlaylist(){
        const response = await axios.post(`https://api.spotify.com/v1/users/`+this.hostid+`/playlists`,
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

    async addToPlaylist(id,uris){
        const response = await axios.post(`https://api.spotify.com/v1/playlists/`+id+`/tracks?position=0&uris=`+uris,{}, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
            });
    }

    isPlayerInGame(playerID){
        return this.players.includes(playerID);
    }

    addPlayerToGame(playerID){
        if (this.isPlayerInGame(playerID)) {
            return "Already in game";
        }else{
            this.players.push(playerID);
            return "Added";
        }
    }

    removePlayerFromGame(playerID){
        if (!this.isPlayerInGame(playerID)) {
            return "Not in game";
        }else{
            this.players.splice(this.players.indexOf(playerID),1);
            return "Removed";
        }
    }

    isHost(playerID){
        return playerID === this.hostPlayerID
    }

    getSongCountForPlayer(playerID){
        var count =0
        this.playlist.forEach((song) => {
            if (playerID === song.playerID) {
                count++
            }
        })
        return count
    }

    addSong(newSong){
        var exists = false
        this.playlist.forEach((song) => {
            if (song.id === newSong.id) {
                exists = true;
                return;
            }
        })
        if (this.getSongCountForPlayer(newSong.playerID) >= this.songsPerPerson){
            return "You have already added all your songs";
        }
        if (exists){
            return "This song is already in the playlist";
        }else{
            this.playlist.push(newSong);
            return "Added";
        }
    }

    removeSong(playerID,oldSong){
        this.playlist.forEach((song,index) => {
            if (oldSong === song.id && song.playerID === playerID) {
                this.playlist.splice(index,1)
            }
        })
    }

    update(playerID){
        let theirSong = []
        let playing = false

        if (this.playlistURL == '') {
            playing=true
            this.playlist.forEach((song) => {
                if (playerID === song.playerID) {
                    theirSong.push(song);
                }
            })
        }
        return {
            validGame:true,
            isPlaying:playing,
            playerCount:this.playerCount,
            songsPerPerson:this.songsPerPerson,
            count:this.playlist.length,
            items:theirSong
        }
    }

    async submit(playerID){
        if (!this.isHost(playerID)){
            return "not host"
        }

        var playlistData = await this.createPlaylist()
        if (this.playlist.length>0){
            var query = ""
            myhelper.shuffle(this.playlist)
            this.playlist.forEach((song)=>{
                query = query+","+song.uri
            })
            query = query.slice(1)
        }
        await this.addToPlaylist(playlistData.data.id,query)
        this.playlist=[]
        this.playlistURL = playlistData.data.external_urls.spotify
        console.log(this.playlistURL);
        return this.playlistURL;
    }

    clear(playerID){
        if (!this.isHost(playerID)){
            return "not host"
        }

        this.playlist=[];
    }

    async tick(){
        let ids = this.players
        this.playlist.forEach((song) => {
            if (!ids.includes(song.playerID)){
                ids.push(song.playerID)
            }
        })
        if (!ids.includes(this.hostPlayerID)){
            ids.push(this.hostPlayerID);
        }
        this.playerCount = ids.length
    }
}

module.exports = {game}