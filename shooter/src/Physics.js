export const Physics = {
  // Axis-Aligned Bounding Box collision detection
  checkCollision(rect1, rect2) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  },
  
  // Resolve collision between player and platform
  resolvePlatformCollision(player, platform) {
    // Check if player is falling onto the platform
    if (player.vy > 0 && 
        player.y + player.height - player.vy <= platform.y + 5 &&
        player.x + player.width > platform.x &&
        player.x < platform.x + platform.width) {
        
        player.y = platform.y - player.height;
        player.vy = 0;
        player.onGround = true;
        return true; // Collision resolved vertically
    }
    return false;
  }
};
