
const myhelper = require('./helper');
const axios = require('axios');

class game{
    constructor(hostid,hostName,accessToken,songsPerPerson){
        this.playlist = [];
        this.playerCount = 0;
        this.playlistURL = '';

        this.gameid = myhelper.makeid(16);
        this.hostid=hostid;
        this.hostName=hostName;
        this.accessToken=accessToken;
        this.songsPerPerson= songsPerPerson;
        this.password = myhelper.makeid(16);
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

    removeSong(oldSong){
        this.playlist.forEach((song,index) => {
            if (oldSong === song.id) {
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

    authAdmin(password){
        if (password == this.password){
            return true
        }
        return false
    }

    async submit(password){
        if (!this.authAdmin(password)){
            return "Incorrect password"
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

    clear(password){
        if (!this.authAdmin(password)){
            return "Incorrect password"
        }

        this.playlist=[];
    }

    async tick(){
        let ids = []
        this.playlist.forEach((song) => {
            if (!ids.includes(song.playerID)){
                ids.push(song.playerID)
            }
        })
        this.playerCount = ids.length
    }
}

module.exports = {game}