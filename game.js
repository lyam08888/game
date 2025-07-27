let levels = ["level1.json", "level2.json", "level3.json"], currentLevel = 0;
let config, level;
let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
let startButton = document.getElementById('startButton');
startButton.style.display = 'none';
let levelSelect = document.getElementById('levelSelect');

// Sprites
let playerImg = new Image(), coinImg = new Image(), enemyImg = new Image();
playerImg.onload = checkStart;
coinImg.onload = checkStart;
enemyImg.onload = checkStart;
playerImg.src = 'assets/player.png';
coinImg.src = 'assets/coin.png';
enemyImg.src = 'assets/enemy.png';

// Son en ligne, pas de fichier local nécessaire
let catchSound = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa94ae.mp3');
let victorySound = new Audio('https://cdn.pixabay.com/audio/2022/10/16/audio_123b6b7e7e.mp3');
let defeatSound = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b7b7e7e.mp3');
let bonusSound = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b7b7e7e.mp3');
let flashPlayer = 0;

// Charger config et premier niveau
fetch('config.json').then(r=>r.json()).then(c=>{ config = c; checkStart(); });
fetch(levels[currentLevel]).then(r=>r.json()).then(l=>{ level = l; checkStart(); });

let ready = 0;
function checkStart() {
  ready++;
  if (ready === 4) {
    startButton.style.display = 'block';
  }
}

let player = { x:0, y:0, size:32 }, coin = { x:0, y:0, size:32 }, enemy = { x:0, y:0, size:32, dx:2, dy:2 }, score=0, gameOver=false, lives=3;
let obstacles = [], bonus = [], enemies = [];
let mobileObstacles = [];
let projectiles = [];
let highScore = 0;
let timer = 30, timerInterval;
let invincible = false, invincibleTimer = 0;
let slowEnemies = false, slowTimer = 0;
startButton.addEventListener('click', () => {
  currentLevel = parseInt(levelSelect.value);
  fetch(levels[currentLevel]).then(r=>r.json()).then(l=>{ level = l; startGame(); });
});
function startGame() {
  document.getElementById('startMenu').style.display = 'none';
  canvas.style.display = 'block';
  player.x = level.playerStart.x;
  player.y = level.playerStart.y;
  coin.x = level.coinStart.x;
  coin.y = level.coinStart.y;
  // Initialiser plusieurs ennemis
  enemies = [
    { x: Math.floor(Math.random()*368), y: Math.floor(Math.random()*368), size:32, dx:2, dy:2 },
    { x: Math.floor(Math.random()*368), y: Math.floor(Math.random()*368), size:32, dx:-3, dy:2 },
    { x: Math.floor(Math.random()*368), y: Math.floor(Math.random()*368), size:32, dx:2, dy:-2 },
    { x: 350, y: 350, size:32, smart:true },
    { x: 200, y: 200, size:32, shooter:true, shootTimer:0 }
  ];
  projectiles = [];
  score = 0;
  gameOver = false;
  lives = 3;
  obstacles = level.obstacles || [];
  bonus = level.bonus || [];
  // Obstacles mobiles (exemple)
  mobileObstacles = [
    { x: 100, y: 50, size:32, dx:2, dy:0 },
    { x: 300, y: 300, size:32, dx:0, dy:-2 }
  ];
  timer = 30;
  invincible = false;
  invincibleTimer = 0;
  slowEnemies = false;
  slowTimer = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if (!gameOver) {
      timer--;
      if (timer <= 0) {
        gameOver = true;
        ctx.fillStyle = "red";
        ctx.font = "32px Arial";
        ctx.fillText('Temps écoulé !', 80, 200);
      }
    }
  }, 1000);
  document.addEventListener('keydown', onKeyDown);
  requestAnimationFrame(gameLoop);
}
function onKeyDown(e) {
  if (gameOver) return;
  let oldX = player.x, oldY = player.y;
  if (e.key==="ArrowUp") player.y -= config.playerSpeed;
  if (e.key==="ArrowDown") player.y += config.playerSpeed;
  if (e.key==="ArrowLeft") player.x -= config.playerSpeed;
  if (e.key==="ArrowRight") player.x += config.playerSpeed;
  // Collision obstacles
  for (let obs of obstacles) {
    if (Math.abs(player.x-obs.x)<32 && Math.abs(player.y-obs.y)<32) {
      player.x = oldX; player.y = oldY;
    }
  }
}
let mission = { type: 'collect', target: 5, progress: 0, timeLimit: 30 };
function showMission() {
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#222';
  ctx.fillRect(50, 40, 300, 40);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = '18px Arial';
  ctx.fillText(`Mission: Attrapez ${mission.target} pièces en ${mission.timeLimit} secondes`, 60, 65);
  ctx.restore();
}
function gameLoop() {
  ctx.clearRect(0,0,400,400);
  showMission();
  // Animation flash sur le joueur
  if (flashPlayer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(player.x+16, player.y+16, 24, 0, 2*Math.PI);
    ctx.fill();
    ctx.restore();
    flashPlayer--;
  }
  ctx.drawImage(playerImg, player.x, player.y, player.size, player.size);
  ctx.drawImage(coinImg, coin.x, coin.y, coin.size, coin.size);
  // Afficher tous les ennemis
  for (let e of enemies) {
    ctx.drawImage(enemyImg, e.x, e.y, e.size, e.size);
    // Ennemi tireur
    if (e.shooter) {
      e.shootTimer = (e.shootTimer || 0) + 1;
      if (e.shootTimer > 60) { // Tire toutes les secondes
        let angle = Math.atan2(player.y - e.y, player.x - e.x);
        projectiles.push({ x: e.x+16, y: e.y+16, dx: Math.cos(angle)*4, dy: Math.sin(angle)*4, size:8 });
        e.shootTimer = 0;
      }
    }
  }
  // Afficher et déplacer les projectiles
  ctx.fillStyle = "orange";
  for (let i=0; i<projectiles.length; i++) {
    let p = projectiles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, 2*Math.PI);
    ctx.fill();
    p.x += p.dx;
    p.y += p.dy;
    // Collision joueur/projectile
    if (!invincible && Math.abs(player.x+16-p.x)<20 && Math.abs(player.y+16-p.y)<20) {
      lives--;
      player.x = level.playerStart.x;
      player.y = level.playerStart.y;
      projectiles.splice(i,1); i--;
      if (lives <= 0) {
        endGame(false);
        return;
      }
    }
    // Suppression projectile hors écran
    if (p.x < 0 || p.x > 400 || p.y < 0 || p.y > 400) {
      projectiles.splice(i,1); i--;
    }
  }
  // Afficher obstacles fixes
  ctx.fillStyle = "gray";
  for (let obs of obstacles) {
    ctx.fillRect(obs.x, obs.y, 32, 32);
  }
  // Afficher obstacles mobiles
  ctx.fillStyle = "blue";
  for (let mob of mobileObstacles) {
    ctx.fillRect(mob.x, mob.y, mob.size, mob.size);
    mob.x += mob.dx;
    mob.y += mob.dy;
    if (mob.x < 0 || mob.x > 368) mob.dx *= -1;
    if (mob.y < 0 || mob.y > 368) mob.dy *= -1;
    // Collision joueur/obstacle mobile
    if (Math.abs(player.x-mob.x)<32 && Math.abs(player.y-mob.y)<32 && !invincible) {
      lives--;
      player.x = level.playerStart.x;
      player.y = level.playerStart.y;
      if (lives <= 0) {
        gameOver = true;
        clearInterval(timerInterval);
        ctx.fillStyle = "red";
        ctx.font = "32px Arial";
        ctx.fillText('Perdu !', 140, 200);
        return;
      }
    }
  }
  // Afficher bonus/malus
  for (let b of bonus) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = b.type === "bonus" ? "yellow" : b.type === "invincible" ? "lime" : b.type === "slow" ? "cyan" : "red";
    ctx.beginPath();
    ctx.arc(b.x+16, b.y+16, 12, 0, 2*Math.PI);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#fff";
  ctx.font = "18px Arial";
  ctx.fillText('Score: ' + score, 10, 30);
  ctx.fillText('Vies: ' + lives, 320, 30);
  ctx.fillText('Temps: ' + timer, 160, 30);
  ctx.fillText('Meilleur score: ' + highScore, 10, 390);
  ctx.fillText(`Progression mission: ${mission.progress}/${mission.target}`, 10, 60);
  // Collision pièce
  if (Math.abs(player.x-coin.x)<32 && Math.abs(player.y-coin.y)<32) {
    score += config.coinScore;
    catchSound.currentTime = 0; catchSound.play();
    coin.x = Math.floor(Math.random()*368);
    coin.y = Math.floor(Math.random()*368);
    mission.progress++;
    // Mission réussie
    if (mission.progress >= mission.target && timer > 0) {
      endGame(true);
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'lime';
      ctx.font = '28px Arial';
      ctx.fillText('Mission accomplie !', 80, 250);
      ctx.restore();
      return;
    }
  }
  // Mission échouée
  if (timer <= 0 && mission.progress < mission.target) {
    endGame(false);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'red';
    ctx.font = '28px Arial';
    ctx.fillText('Mission échouée !', 80, 250);
    ctx.restore();
    return;
  }
  // Déplacement ennemis
  for (let e of enemies) {
    if (e.smart) {
      // Ennemi intelligent poursuit le joueur
      let speed = slowEnemies ? 1 : 2;
      if (player.x < e.x) e.x -= speed;
      if (player.x > e.x) e.x += speed;
      if (player.y < e.y) e.y -= speed;
      if (player.y > e.y) e.y += speed;
    } else {
      let dx = slowEnemies ? e.dx/2 : e.dx;
      let dy = slowEnemies ? e.dy/2 : e.dy;
      e.x += dx;
      e.y += dy;
      if (e.x < 0 || e.x > 368) e.dx *= -1;
      if (e.y < 0 || e.y > 368) e.dy *= -1;
    }
    // Collision joueur/ennemi
    if (!invincible && Math.abs(player.x-e.x)<32 && Math.abs(player.y-e.y)<32) {
      lives--;
      player.x = level.playerStart.x;
      player.y = level.playerStart.y;
      if (lives <= 0) {
        gameOver = true;
        clearInterval(timerInterval);
        ctx.fillStyle = "red";
        ctx.font = "32px Arial";
        ctx.fillText('Perdu !', 140, 200);
        return;
      }
    }
  }
  // Collision bonus/malus
  for (let i=0; i<bonus.length; i++) {
    let b = bonus[i];
    if (Math.abs(player.x-b.x)<32 && Math.abs(player.y-b.y)<32) {
      if (b.type === "bonus") {
        score += 20;
        bonusSound.currentTime = 0; bonusSound.play();
        flashPlayer = 15;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "yellow";
        ctx.fillRect(0,0,400,400);
        ctx.restore();
      }
      if (b.type === "malus") {
        lives--;
        defeatSound.currentTime = 0; defeatSound.play();
        flashPlayer = 15;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "red";
        ctx.fillRect(0,0,400,400);
        ctx.restore();
      }
      if (b.type === "invincible") {
        invincible = true;
        invincibleTimer = 180;
        bonusSound.currentTime = 0; bonusSound.play();
        flashPlayer = 15;
      }
      if (b.type === "slow") {
        slowEnemies = true;
        slowTimer = 180;
        bonusSound.currentTime = 0; bonusSound.play();
        flashPlayer = 15;
      }
      bonus.splice(i,1); i--;
    }
  }
  // Timer invincibilité
  if (invincible) {
    invincibleTimer--;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "lime";
    ctx.fillRect(0,0,400,400);
    ctx.restore();
    if (invincibleTimer <= 0) invincible = false;
  }
  // Timer slow
  if (slowEnemies) {
    slowTimer--;
    if (slowTimer <= 0) slowEnemies = false;
  }
  if (!gameOver) requestAnimationFrame(gameLoop);
}

let scores = [];
function showScores() {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#222';
  ctx.fillRect(50, 80, 300, 220);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = '22px Arial';
  ctx.fillText('Tableau des scores', 90, 110);
  ctx.font = '18px Arial';
  for (let i = 0; i < scores.length && i < 5; i++) {
    ctx.fillText(`${i+1}. ${scores[i]}`, 90, 140 + i*30);
  }
  ctx.font = '16px Arial';
  ctx.fillText('Appuyez sur Entrée pour rejouer', 90, 250);
  ctx.restore();
  document.addEventListener('keydown', restartOnEnter);
}
function restartOnEnter(e) {
  if (e.key === 'Enter') {
    document.removeEventListener('keydown', restartOnEnter);
    document.getElementById('startMenu').style.display = 'block';
    canvas.style.display = 'none';
  }
}
function endGame(victory) {
  gameOver = true;
  clearInterval(timerInterval);
  scores.push(score);
  scores.sort((a,b)=>b-a);
  if (victory) {
    victorySound.currentTime = 0; victorySound.play();
    ctx.fillStyle = "green";
    ctx.font = "32px Arial";
    ctx.fillText('Victoire !', 120, 200);
  } else {
    defeatSound.currentTime = 0; defeatSound.play();
    ctx.fillStyle = "red";
    ctx.font = "32px Arial";
    ctx.fillText('Perdu !', 140, 200);
  }
  showScores();
}
// Remplacez les appels de fin de partie par endGame(victory)
// Exemple : endGame(true) pour victoire, endGame(false) pour défaite
