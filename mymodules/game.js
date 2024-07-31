
const myhelper = require('./helper');
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