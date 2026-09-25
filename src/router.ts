const params = new URLSearchParams(location.search);
if (params.get('mode') === 'play' || params.get('level')) {
  import('./workshop/app');
} else {
  import('./home/app');
}
