// Runs before paint so a saved night preference also survives full page loads.
export const themeBootScript = `(function(){try{var t=localStorage.getItem('zangraf-theme');if(!t&&localStorage.getItem('zangraf-studio-night-v1')==='true')t='dark';document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){}})()`;

