// Categorical colours for charts, chosen to stay distinct from each other on the dark
// background. The first is Spotify green, which the single-colour charts also use.
export const SERIES_COLORS = ['#1ed760', '#ffd166', '#4cc9f0', '#f78fb3', '#b388ff', '#ff9f6e', '#9ad1ff', '#c3e88d'];

export const colorFor = (index) => SERIES_COLORS[index % SERIES_COLORS.length];
