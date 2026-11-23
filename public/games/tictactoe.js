// ⚔️ TicTacToe has been upgraded to Territory Conquest (Empire Wars)!
// This file ensures backward compatibility for any existing room or client call.
if (typeof TerritoryGame !== 'undefined') {
  window.TicTacToeGame = TerritoryGame;
} else {
  window.TicTacToeGame = class extends window.TerritoryGame {};
}
