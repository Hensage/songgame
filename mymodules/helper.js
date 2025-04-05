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
    // Fill array with maxSongs e.g. [3,3,3]
    // Counts songs left to be added for each player
    let p_counts = Array(players.length).fill(maxSongs)

    let shuffled_songs = []

    // While shuffled_songs is incomplete
    while (shuffled_songs.length < maxSongs*players.length) {

        // Calculate softmax of counts - Leaving 0 as 0
        let p_exp = p_counts.map(p => (p === 0 ? 0 : Math.exp(p)))
        let p_sum = p_exp.reduce((p_1,p_2) => p_1 + p_2, 0)
        let p_softmax = p_exp.map(p => (p === 0 ? 0 : p / p_sum))

        // Get index using weighted selection
        let p_index = weightedRandom(p_softmax);
        let player = players[p_index]
        p_counts[p_index] -= 1
        
        let songs = array.filter((song) => song.playerID == player)
        let song = songs[Math.floor((songs.length) * Math.random())]

        // Remove chosen song from array and add to output
        array = array.filter(s => s !== song)
        shuffled_songs.push(song)
    }
    
    return shuffled_songs
}

function weightedRandom(probabilities) {
    const rand = Math.random();
    let sum = 0;
    for (let i = 0; i < probabilities.length; i++) {
        sum += probabilities[i];
        if (rand < sum) return i;
    }
    return probabilities.length - 1;
}

module.exports = {makeid, shuffle}