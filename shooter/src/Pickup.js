export class Pickup {
  constructor(x, y, type, weapon = null) {
    this.x = x;
    this.y = y;
    this.width = 30;
    this.height = 30;
    this.type = type; // 'weapon', 'health'
    this.weapon = weapon; // Si es tipo 'weapon'
    this.markedForDeletion = false;
  }

  draw(ctx) {
    // Dibujar la caja principal
    if (this.type === 'weapon') {
      ctx.fillStyle = '#6b5c35'; // Marrón de madera/suministro
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Detalles de la caja
      ctx.strokeStyle = '#4a4025';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      
      // Símbolo de arma (una W o similar)
      ctx.fillStyle = '#c9b161'; // Dorado
      ctx.font = '16px Courier New';
      ctx.fillText('W', this.x + 8, this.y + 20);
    } 
    else if (this.type === 'health') {
      ctx.fillStyle = '#cfcfcf'; // Caja blanca/gris clara
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Cruz roja
      ctx.fillStyle = '#a33c3c';
      // Barra vertical
      ctx.fillRect(this.x + 12, this.y + 5, 6, 20);
      // Barra horizontal
      ctx.fillRect(this.x + 5, this.y + 12, 20, 6);
    }
  }
}
