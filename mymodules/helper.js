function makeid(length){
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

function shuffle(array,players,maxSongs){
    let currentIndex = array.length;
    
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    let rounds = [];
    for (let i = 0; i < maxSongs; i++) {
        rounds.push([]);
    }
    for (let i = 0; i < players.length; i++) {
        let songs = array.filter((song) => song.playerID == players[i])
        for (let j = 0; j < songs.length; j++) {
            let select = Math.random();
            if (j > 0 && select < 0.2) {
                rounds[j-1].splice((rounds[j].length+1) * Math.random() | 0, 0, songs[j])
            } else if(j < songs.length-1 && select > 0.8) {
                rounds[j+1].splice((rounds[j].length+1) * Math.random() | 0, 0, songs[j])
            } else {
                rounds[j].splice((rounds[j].length+1) * Math.random() | 0, 0, songs[j])
            }
        }
    }
    return rounds.flat();
}

module.exports = {makeid, shuffle}