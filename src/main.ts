import Phaser from 'phaser';

interface Field {
index: number;
sprite: Phaser.GameObjects.Image;
waterLevel: number;
sunLevel: number;
plantLevel: number;
texture?: string;
}

class MyGame extends Phaser.Scene {
  private fields: Field[] = [];
  private farmer: Phaser.GameObjects.Sprite | null = null;
  private keyA: Phaser.Input.Keyboard.Key | undefined;
  private keyS: Phaser.Input.Keyboard.Key | undefined;
  private keyD: Phaser.Input.Keyboard.Key | undefined;
  private keyW: Phaser.Input.Keyboard.Key | undefined;
  private stage3Counter: number = 0;
  private counterText: Phaser.GameObjects.Text | undefined;
  private dayCounter: number = 0;
  private dayText: Phaser.GameObjects.Text | undefined;
  private winText: Phaser.GameObjects.Text | undefined;
  private waterText: Phaser.GameObjects.Text | undefined;
  private sunText: Phaser.GameObjects.Text | undefined;
  private reapButton: Phaser.GameObjects.Text | undefined;
  private sowButton: Phaser.GameObjects.Text | undefined;
  private undoButton: Phaser.GameObjects.Text | undefined;
  private redoButton: Phaser.GameObjects.Text | undefined;

  private undoStack: Field[][] = []; // Stack for undo
  private redoStack: Field[][] = []; // Stack for redo
   constructor() {
      super('game');
  }

  preload() {
      this.load.image('background', './Background.png');
      this.load.image('field', './Field.png');
      this.load.image('Sunflower', './Sunflower1.png');
      this.load.image('Sunflower2', './Sunflower2.png');
      this.load.image('Sunflower3', './Sunflower3.png');
      this.load.image('Herb', './Herb1.png');
      this.load.image('Herb2', './Herb2.png');
      this.load.image('Herb3', './Herb3.png');
      this.load.image('Mushroom', './Mush1.png');
      this.load.image('Mushroom2', './Mush2.png');
      this.load.image('Mushroom3', './Mush3.png');
      this.load.image('farmer', './farmer.png');
  }

  create() {
    //WASD creation
    this.keyA = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);

    // Add background
    let background = this.add.image(this.scale.width / 2, this.scale.height / 2, 'background');
    background.setScale(0.86, 0.86);

    // Define grid parameters
    const gridStartX = 60;
    const gridStartY = 240;
    const gridCols = 7;
    const gridRows = 4;
    const fieldSize = 64;
    let fieldIndex = 0;
  
    // Create grid of fields with properties
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const x = gridStartX + col * fieldSize;
        const y = gridStartY + row * fieldSize;

        let fieldSprite = this.add.image(x, y, 'field').setOrigin(0);
        fieldSprite.setScale(0.2, 0.2);
        fieldSprite.setInteractive();

        let field: Field = {
          index: fieldIndex,
          sprite: fieldSprite,
          waterLevel: 0,
          sunLevel: 0,
          plantLevel: 0
        };

        // Add field object to array
        this.fields.push(field);

        // Increment field index
        fieldIndex++;

        // Add event listener when player clicks on field
        fieldSprite.on('pointerdown', () => {
          if (this.farmer) {
              // Calculate the distance between the farmer and the field
              const distance = Phaser.Math.Distance.Between(
                  this.farmer.x,
                  this.farmer.y,
                  field.sprite.x + field.sprite.displayWidth / 2,
                  field.sprite.y + field.sprite.displayHeight / 2,
              );
    
              const range = 130; // Define the range in pixels
            
              // Message if player is out of range
              if (distance > range) {
                  console.log(`Field ${field.index} is out of range (${distance.toFixed(1)}px).`);
                  return;
              }
          }
          this.handleFieldSelection(field);

          // Displays/Destroys water and sun level text
          if (this.waterText) {
              this.waterText.destroy();
          }
          this.waterText = this.add.text(
              this.scale.width / 20,
              this.scale.height / 14,
              `Water Level: ${field.waterLevel}`,
              { font: '22px Arial', color: '#fff', fontSize: 20 }
          );
    
          if (this.sunText) {
              this.sunText.destroy();
          }
          this.sunText = this.add.text(
              this.scale.width / 20,
              this.scale.height / 14 - 25,
              `Sun Level: ${field.sunLevel}`,
              { font: '22px Arial', color: '#fff', fontSize: 20 }
          );
        });

        // Destroys water and sun level text if player clicks off a field
        this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
          const clickedField = currentlyOver.find(obj => this.fields.some(field => field.sprite === obj));
           if (!clickedField && this.waterText) {
            this.waterText.destroy();
            this.waterText = undefined;
          }

          if (!clickedField && this.sunText) {
            this.sunText.destroy();
            this.sunText = undefined;
          }
        });
      }
    }

    // Stage 3 Plants Counters
    this.counterText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 6,
      `Plants at stage 3: ${this.stage3Counter}`,
      { font: '20px Arial'}
    );
    this.counterText.setOrigin(0.5, 1);

    // Add Farmer
    this.farmer = this.add.sprite(75, 75, 'farmer');
    this.farmer.setScale(0.5, 0.5);

    // Turn Counter
    this.dayText = this.add.text(
      50,
      this.cameras.main.height - 6,
      `Days: ${this.dayCounter}`,
      { font: '20px Arial'}
    );
    this.dayText.setOrigin(0.5, 1);

    // Turn button
    const button = this.add.text(400, 300, 'Next Day', {
      fontSize: '20px',
      backgroundColor: '#21a99c',
      padding: { x: 20, y: 10 },
      align: 'center'
    });
    button.setX(this.cameras.main.width - button.width - 10);
    button.setY(10);
    button.setInteractive();

    // Randomize water and sun levels when button is clicked
    button.on('pointerdown', () => {
      this.dayCounter++;
      this.dayText?.setText(`Days: ${this.dayCounter}`);
      this.assignRandomLevels();
      this.saveGameState();
    });

    const savedState = localStorage.getItem('gameState');
    if (savedState)
    {
      const promptText = this.add.text(250, 200,
      'Continue previous game? (Y/N)',
          { font: '20px Arial', color: '#fff' }
      ).setOrigin(0.5, 0.5);

      if (this.input?.keyboard) {
        const keyY = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
        const keyN = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
  
        keyY.once('down', () => {
            this.loadGameState();
            promptText.destroy();
        });
  
        keyN.once('down', () => {
            localStorage.removeItem('gameState'); // Clear old data
            promptText.destroy();
        });
      }
    }

    // Save Button
const saveButton = this.add.text(375, 95, 'Save Game', {
fontSize: '20px',
backgroundColor: '#f39c12',
padding: { x: 6, y: 6 },
align: 'center'
}).setInteractive();

saveButton.on('pointerdown', () => {
//this.saveGame();
const loadState = localStorage.getItem('game');
    if (loadState)
    {
      const promptText = this.add.text(250, 200,
      'Click on keys: 1    2    3    B',
          { font: '20px Arial', color: '#fff' }
      ).setOrigin(0.5, 0.5);

      if (this.input?.keyboard) {
        const key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        const key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        const key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
        const keyB = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
  
        key1.once('down', () => {
            this.saveGame('1');
            promptText.destroy();
        });
  
        key2.once('down', () => {
          this.saveGame('2');
            promptText.destroy();
        });

        key3.once('down', () => {
          this.saveGame('3');
            promptText.destroy();
        });

        keyB.once('down', () => {
            promptText.destroy();
        });
      }
    }
});

// Load Button
const loadButton = this.add.text(375, 55, 'Load Game', {
fontSize: '20px',
backgroundColor: '#2980b9',
padding: { x: 6, y: 6 },
align: 'center'
}).setInteractive();

loadButton.on('pointerdown', () => {
const loadState = localStorage.getItem('game');
    if (loadState)
    {
      const promptText = this.add.text(250, 200,
      'Continue from auto-save(Y) or save(N)? (Y/N)',
          { font: '20px Arial', color: '#fff' }
      ).setOrigin(0.5, 0.5);

      if (this.input?.keyboard) {
        const keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
        const keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
  
        keyA.once('down', () => {
            this.loadGameState();
            promptText.destroy();
        });
  
        keyS.once('down', () => {
          //this.loadGame();
            promptText.destroy();
            const promptTexts = this.add.text(250, 200,
              'Click on keys: 1    2    3    B',
                  { font: '20px Arial', color: '#fff' }
              ).setOrigin(0.5, 0.5);
              if (this.input?.keyboard) {
                const key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
                const key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
                const key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
                const keyB = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);

                key1.once('down', () => {
                  this.loadGame('1');
                  promptTexts.destroy();
                });

                key2.once('down', () => {
                  this.loadGame('2');
                  promptTexts.destroy();
                });

                key3.once('down', () => {
                  this.loadGame('3');
                  promptTexts.destroy();
                });

                keyB.once('down', () => {
                  promptTexts.destroy();
              });
              }
        });
      }
    }
    else {
      console.log("No save state found.");
      this.loadGameState();
    }
});

// Auto-save every 60 seconds (60000 milliseconds)
setInterval(() => {
this.saveGameState();
console.log("Game auto-saved");
}, 60000); // 60,000 milliseconds = 1 minute

// Create Undo Button
this.undoButton = this.add.text(193, 10, 'Undo', {
fontSize: '20px',
backgroundColor: '#f39c12',
padding: { x: 5, y: 2 },
}).setInteractive();

this.undoButton.on('pointerdown', () => {
console.log("clicked on undo button");
this.undo();
this.saveGameState(); // Save the state after undoing
});
this.redoButton = this.add.text(250, 10, 'Redo', {
fontSize: '20px',
backgroundColor: '#2ecc71',
padding: { x: 5, y: 2 },
}).setInteractive();
this.redoButton.on('pointerdown', () => {
this.redo();
this.saveGameState(); // Save the state after redoing
});

// Add event listener when player clicks on field
this.fields.forEach(field => {
field.sprite.on('pointerdown', () => {
    this.handleFieldSelection(field);
    //this.saveGameState(); // Save state every time a change happens
});
});
this.undoStack.push(this.getCurrentState());
  }

  update () {
    //Player Movement
    if (this.farmer) {
    const moveSpeed = 3;
    if (this.keyA!.isDown) {
      this.farmer.x -= moveSpeed;
    } else if (this.keyD!.isDown) {
      this.farmer.x += moveSpeed;
    }
    if (this.keyW!.isDown) {
      this.farmer.y -= moveSpeed;
    } else if (this.keyS!.isDown) {
      this.farmer.y += moveSpeed;
    }
    }
    // Check water and sun levels for plant growth
    this.fields.forEach(field => {
      if (field.plantLevel > 0) {
        const waterThreshold = 50;
        const sunThreshold = 50;
        const finalWaterThreshold = 100;
        const finalSunThreshold = 80;
        // Gets neighboring plants and increases water threshold based on amount of neighbors
        const neighborsWithPlants = this.getNeighbors(field).filter(neighbor => neighbor.plantLevel > 0).length;
        const adjustedWaterThreshold = waterThreshold + 10 * neighborsWithPlants;
        const finalAdjustedWaterThreshold = finalWaterThreshold + 10 * neighborsWithPlants;
        if (field.waterLevel >= adjustedWaterThreshold && field.sunLevel >= sunThreshold) {
          if (field.plantLevel === 1) {
              this.updatePlantTexture(field, 2);
              field.waterLevel -= adjustedWaterThreshold;
          }
        }
        if (field.waterLevel >= finalAdjustedWaterThreshold && field.sunLevel >= finalSunThreshold) {
            if (field.plantLevel === 2) {
                this.updatePlantTexture(field, 3);
                this.incrementCounter();
                field.waterLevel -= finalWaterThreshold;
            }
        }
      }
    })
    if (this.stage3Counter >= 10) {
      this.winText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        `You Win!`,
        { font: '100px Arial',
          fontStyle: 'bold',
          color: '#21a99c'
         }
      );
      this.winText.setOrigin(0.5, 0.5);
    }
  }

  private incrementCounter() {
    this.stage3Counter++;
    this.counterText?.setText(`Plants at stage 3: ${this.stage3Counter}`);
  }

  // Randomly assigns value to each field's water and sun level
  private assignRandomLevels(): void {
    this.fields.forEach(field => {
        field.waterLevel += Phaser.Math.Between(0, 10);
        field.sunLevel = Phaser.Math.Between(0, 100);
    });
     console.log("Random levels assigned to fields:", this.fields);
  }

  // Displays reap and sow buttons when player clicks on field
  private handleFieldSelection(field: Field): void {
    // Deselect the previous field
    if (this.reapButton) this.reapButton.destroy();
    if (this.sowButton) this.sowButton.destroy();
    // Display Reap and Sow buttons
    const buttonY = field.sprite.y - 20;
    this.reapButton = this.add.text(field.sprite.x - 20, buttonY, 'Reap', {
        fontSize: '14px',
        backgroundColor: '#ff6666',
        padding: { x: 7, y: 3 },
    }).setInteractive();
    this.sowButton = this.add.text(field.sprite.x + 30, buttonY, 'Sow', {
        fontSize: '14px',
        backgroundColor: '#66cc66',
        padding: { x: 7, y: 3 },
    }).setInteractive();

    // Reap button functionality
    this.reapButton.on('pointerdown', () => {
        console.log(`Reaped field ${field.index}`);
        this.undoStack.push(this.getCurrentState());
        this.redoStack = [];
        field.sprite.setTexture('field');
        // Additional logic for reaping (e.g., resetting levels, clearing plants)
        if (field.sprite.texture.key !== 'field') {
            field.sprite.setTexture('field');
            if (field.plantLevel === 3) {
              console.log('dex');
              this.stage3Counter -= 1;
              this.counterText?.setText(`Plants at stage 3: ${this.stage3Counter}`);
            }
            field.plantLevel = 0;
        }
        this.saveGameState();
    });

    // Sow button functionality
    this.sowButton.on('pointerdown', () => {
        this.undoStack.push(this.getCurrentState()); // Save the current state before sowing
        this.redoStack = [];
        this.showSowMenu(field);
        this.saveGameState();
    });
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      const clickedField = currentlyOver.find(obj => this.fields.some(field => field.sprite === obj));
      if (!clickedField && this.reapButton) {
        this.reapButton.destroy();
      }
      if (!clickedField && this.sowButton) {
        this.sowButton.destroy();
      }
      this.saveGameState();
    });
}

// Displays plant choices after player clicks sow
private showSowMenu(field: Field): void {
    // Show plant choices near the selected field
    const options = ['Sunflower', 'Mushroom', 'Herb'];
    const optionY = field.sprite.y - 20;
    const choiceTexts: Phaser.GameObjects.Text[] = [];
    options.forEach((key, index) => {
      // Create button for each option
        const choiceText = this.add.text((field.sprite.x + index * 80)-80, optionY, key, {
            fontSize: '12px',
            backgroundColor: '#358f39',
            padding: { x: 5, y: 2 },
        }).setInteractive();
        // Update field with plant image
        choiceText.on('pointerdown', () => {
            console.log(`Planted ${key} on field ${field.index}`);
            field.sprite.setTexture(key);
            field.plantLevel = 1;
            choiceTexts.forEach(text => text.destroy());
        });
        choiceTexts.push(choiceText);
    });
}

// Updates plant texture to next stage
private updatePlantTexture(field: Field, nextStage: number) {
  let textureKey = '';
  switch (nextStage) {
    case 2:
      textureKey = this.getNextPlantTexture(field.sprite.texture.key, 2);
      break;
    case 3:
      textureKey = this.getNextPlantTexture(field.sprite.texture.key, 3);
      break;
  }

  if (textureKey) {
    field.sprite.setTexture(textureKey);
    field.plantLevel = nextStage;
    console.log(nextStage);
  }
}

// Gets next plant texture
private getNextPlantTexture(currentTexture: string, stage: number): string {
  const plantMap: { [key: string]: string[] } = {
      'Sunflower': ['Sunflower', 'Sunflower2', 'Sunflower3', 'Sunflower3'],
      'Mushroom': ['Mushroom', 'Mushroom2', 'Mushroom3', 'Mushroom3'],
      'Herb': ['Herb', 'Herb2', 'Herb3', 'Herb3'],
  };

  // Find the current plant's texture list based on the texture key
  const plantTextures = plantMap[currentTexture.split('2')[0] || currentTexture.split('3')[0]];
   // Return the next texture based on the current stage
  if (stage < plantTextures.length) {
      return plantTextures[stage - 1];
  }
  return currentTexture; // If no next stage, return the current texture
}
private getNeighbors(field: Field): Field[] {
  const neighbors: Field[] = [];
  const fieldIndex = field.index;
  const gridCols = 7;
  const gridRows = 4;
  const row = Math.floor(fieldIndex / gridCols);
  const col = fieldIndex % gridCols;

  // Check neighbors in 4 directions (up, down, left, right)
  if (row > 0) neighbors.push(this.fields[fieldIndex - gridCols]);
  if (row < gridRows - 1) neighbors.push(this.fields[fieldIndex + gridCols]);
  if (col > 0) neighbors.push(this.fields[fieldIndex - 1]);
  if (col < gridCols - 1) neighbors.push(this.fields[fieldIndex + 1]);
  return neighbors;
}

private saveGameState(): void
{
const gameState = {
  fields: this.fields.map(field => ({
    index: field.index,
    waterLevel: field.waterLevel,
    sunLevel: field.sunLevel,
    plantLevel: field.plantLevel,
    texture: field.sprite.texture.key,  // Save the texture key
  })),
  farmer: {
    x: this.farmer?.x || 0,
    y: this.farmer?.y || 0,
  },
  dayCounter: this.dayCounter,
  stage3Counter: this.stage3Counter,
};

this.undoStack.push(this.cloneState(this.fields));
if (this.undoStack.length > 20) {
  this.undoStack.shift(); // Limit the stack size to prevent memory issues
}
this.redoStack = [];
localStorage.setItem('gameState', JSON.stringify(gameState));

console.log("State saved. Undo Stack:", this.undoStack);
}

private loadGameState(): void
{
  const savedState = localStorage.getItem('gameState');
  if (savedState)
  {
    const gameState = JSON.parse(savedState);
    this.fields.forEach((field, index) => {
      const savedField = gameState.fields[index];
      if (savedField)
      {
        field.waterLevel = savedField.waterLevel;
        field.sunLevel = savedField.sunLevel;
        field.plantLevel = savedField.plantLevel;
        field.sprite.setTexture(savedField.texture);
      }
    });
    if (this.farmer)
    {
      this.farmer.x = gameState.farmer.x;
      this.farmer.y = gameState.farmer.y;
    }
    this.dayCounter = gameState.dayCounter;
    this.stage3Counter = gameState.stage3Counter;
    this.dayText?.setText(`Days: ${this.dayCounter}`);
    this.counterText?.setText(`Plants at stage 3: ${this.stage3Counter}`);
    console.log('Game loaded :3');
  }
}

private saveGame(name: string): void
{
  const gameState = {
    fields: this.fields.map(field => ({
      index: field.index,
      waterLevel: field.waterLevel,
      sunLevel: field.sunLevel,
      plantLevel: field.plantLevel,
      texture: field.sprite.texture.key,
    })),
    farmer: {
      x: this.farmer?.x || 0,
      y: this.farmer?.y || 0,
    },
    dayCounter: this.dayCounter,
    stage3Counter: this.stage3Counter,
  };
  localStorage.setItem(name, JSON.stringify(gameState));
  console.log('saved game from saved file ' + name);
}

private loadGame(name: string): void
{
  const savedState = localStorage.getItem(name);
  if (savedState)
  {
    const gameState = JSON.parse(savedState);
    this.fields.forEach((field, index) => {
      const savedField = gameState.fields[index];
      if (savedField)
      {
        field.waterLevel = savedField.waterLevel;
        field.sunLevel = savedField.sunLevel;
        field.plantLevel = savedField.plantLevel;
        field.sprite.setTexture(savedField.texture);
      }
    });
    if (this.farmer)
    {
      this.farmer.x = gameState.farmer.x;
      this.farmer.y = gameState.farmer.y;
    }
    this.dayCounter = gameState.dayCounter;
    this.stage3Counter = gameState.stage3Counter;
    this.dayText?.setText(`Days: ${this.dayCounter}`);
    this.counterText?.setText(`Plants at stage 3: ${this.stage3Counter}`);
    console.log('Game loaded from save file ' + name);
  }
}

private undo() {
 console.log("Undo function called.");
 /*console.log("Before undo:");
 console.log("Undo Stack:", this.undoStack);
 console.log("Redo Stack:", this.redoStack);*/


 if (this.undoStack.length > 1) {
     const originalLength = this.undoStack.length; // Track the length before shift
     const removedState = this.undoStack.pop(); // Removes and returns the first state


     // Check and log the removed state
     if (removedState) {
         console.log("Removed state successfully:", removedState);
         this.redoStack.push(removedState); // Add the removed state to the redo stack
     } else {
         console.warn("No state was removed. Undo stack might be empty or corrupted.");
     }


     // Check the undo stack after removal
     const newLength = this.undoStack.length;
     console.log(`Undo stack size before: ${originalLength}, after: ${newLength}`);
     if (newLength === originalLength - 1) {
         console.log("State was successfully removed from the undo stack.");
     } else {
         console.warn("Undo stack size did not decrease as expected.");
     }


     // Verify the current state
     const currentState = this.undoStack[0]; // The new "current state" is now the next in line
     console.log("Restoring state from:", currentState);


     if (currentState) {
         this.restoreState(currentState); // Restore the first state
     } else {
         console.log("No state to restore.");
     }
 } else {
     console.log("No more actions to undo.");
 }
}

private redo() {
console.log("Redo function called.");
/*console.log("Before redo:");
console.log("Undo Stack:", this.undoStack);
console.log("Redo Stack:", this.redoStack);*/

if (this.redoStack.length > 0) {
    const redoState = this.redoStack.pop(); // Get the next state to redo
    if (redoState) {
        this.undoStack.push(redoState); // Push the current state to the undo stack
        this.restoreState(redoState); // Restore the state
    }
} else {
    console.log("No more actions to redo.");
}
console.log("After redo:");
console.log("Undo Stack:", this.undoStack);
console.log("Redo Stack:", this.redoStack);
}

private cloneState(state: Field[]): Field[] {
return state.map(field => ({
  index: field.index,
  sprite: field.sprite,  // Clone the sprite object (or just the key if you prefer)
  waterLevel: field.waterLevel,
  sunLevel: field.sunLevel,
  plantLevel: field.plantLevel,
  texture: field.sprite.texture.key,  // Store the texture key for future restoration
}));
}



private restoreState(state: Field[]) {
 this.fields.forEach((field, index) => {
   const savedField = state[index];
   field.waterLevel = savedField.waterLevel;
   field.sunLevel = savedField.sunLevel;
   field.plantLevel = savedField.plantLevel;
   field.texture = savedField.texture;


   // Log sprite and savedField details
   console.log(`Field at index ${index} - Sprite:`, field.sprite);
   console.log(`Field at index ${index} - Saved State:`, savedField);


   if (field.sprite instanceof Phaser.GameObjects.Image && savedField?.texture) {
     // Only set the texture if the sprite is an instance of Phaser.GameObjects.Image and the texture is valid
     console.log(`Restoring game state for field at index ${index}`);
     console.log(`Saved field data: `, savedField);
     console.log(`Water Level: `, savedField.waterLevel);
     console.log(`Sun Level: `, savedField.sunLevel);
     console.log(`Plant Level: `, savedField.plantLevel);
     console.log(`Texture key: `, savedField.texture);


     // Set the texture on the sprite if all checks are valid
     field.sprite.setTexture(savedField.texture);
     this.updatePlantTextures(savedField, savedField.plantLevel);
     console.log(`Restored texture: `, savedField.texture);
   } else {
     console.warn(`No valid sprite or texture found for field at index ${index}`);
     if (!(field.sprite instanceof Phaser.GameObjects.Image)) {
       console.warn(`Sprite is not a Phaser.GameObjects.Image. Found:`, field.sprite);
     }
     if (!savedField?.texture) {
       console.warn(`Saved field texture is missing or undefined. Saved Field:`, savedField);
     }
   }
 });
}

private getCurrentState(): any {
  return this.fields.map(field => ({
    index: field.index,
    waterLevel: field.waterLevel,
    sunLevel: field.sunLevel,
    plantLevel: field.plantLevel
  }));
} Hello people 
 
// Updates plant texture to next stage
private updatePlantTextures(field: Field, nextStage: number) {
  let textureKey = '';

  switch (nextStage) {
    case 1:
      textureKey = this.getPreviousPlantTexture(field.sprite.texture.key, 1);
      break;
    case 2: 
      textureKey = this.getPreviousPlantTexture(field.sprite.texture.key, 2);
      break;
  }

  if (textureKey) {
    field.sprite.setTexture(textureKey);
    field.plantLevel = nextStage;
    console.log("next stage: " + nextStage);
  }
}

private getPreviousPlantTexture(currentTexture: string, stage: number): string {
  const plantMap: { [key: string]: string[] } = {
    'Sunflower': ['Sunflower', 'Sunflower2', 'Sunflower3', 'Sunflower3'],
    'Mushroom': ['Mushroom', 'Mushroom2', 'Mushroom3', 'Mushroom3'],
    'Herb': ['Herb', 'Herb2', 'Herb3', 'Herb3'],
  };

  // Find the current plant's texture list based on the texture key
  const plantTextures = plantMap[currentTexture.split('2')[0] || currentTexture.split('3')[0]];

  // If the current texture exists and isn't the first stage, return the previous texture
  if (stage > 0) {
    console.log("texture number: " + plantTextures[stage - 1]);
    return plantTextures[stage - 1];
  }

  // If it's the first stage or no valid texture, return the current texture
  console.log("current texture: " + currentTexture);
  return ;
}

}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 512,
  height: 512,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 200 },
    },
  },
  scene: MyGame
};

new Phaser.Game(config);


