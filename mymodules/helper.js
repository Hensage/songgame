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

function shuffle(array, players, maxSongs) {
    // Calculate initial quotas (min of maxSongs and actual song count per player)
    let p_counts = players.map(player => {
        let count = array.filter(song => song.playerID === player).length;
        return Math.min(count, maxSongs);
    });
    
    let totalSongs = p_counts.reduce((sum, count) => sum + count, 0);
    let shuffled_songs = [];
    
    // Loop until we've selected all songs based on quotas
    while (shuffled_songs.length < totalSongs) {
        // Calculate softmax only for players with remaining quota
        let p_exp = p_counts.map(p => p > 0 ? Math.exp(p) : 0);
        let p_sum = p_exp.reduce((sum, val) => sum + val, 0);
        
        // Break if no valid players left (shouldn't happen if counts are correct)
        if (p_sum <= 0) break;
        
        let p_softmax = p_exp.map(val => val / p_sum);
        
        // Select a player based on weighted probability
        let p_index = weightedRandom(p_softmax);
        let player = players[p_index];
        
        // Decrement the player's quota
        p_counts[p_index] -= 1;
        
        // Get available songs for this player
        let songs = array.filter(song => song.playerID === player);
        if (songs.length === 0) {
            // Shouldn't occur if counts are accurate, but skip to prevent undefined
            continue;
        }
        
        // Pick a random song from available songs
        let song = songs[Math.floor(Math.random() * songs.length)];
        shuffled_songs.push(song);
        
        // Remove selected song from the pool
        array = array.filter(s => s !== song);
    }
    
    return shuffled_songs;
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