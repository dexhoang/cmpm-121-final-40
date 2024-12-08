// This is what i was working on earlier
const PlantTypes = {
    Sunflower: {
        name: 'Sunflower',
        texture: 'Sunflower',
        growthConditions: {
            waterLevel: 50,
            sunLevel: 70,
            neighborsNeeded: 0,
        },
        finalGrowthConditions: {
            waterLevel: 100,
            sunLevel: 90,
        },
        uniqueGrowthCondition: (field, neighbors) =>
            neighbors.every(neighbor => neighbor.plantLevel === 0), // No neighbors
    },
    Mushroom: {
        name: 'Mushroom',
        texture: 'Mushroom',
        growthConditions: {
            waterLevel: 60,
            sunLevel: 30,
            neighborsNeeded: 1,
        },
        finalGrowthConditions: {
            waterLevel: 120,
            sunLevel: 50,
        },
        uniqueGrowthCondition: (field, neighbors) =>
            neighbors.some(neighbor => neighbor.plantLevel > 0 && neighbor.texture === 'Herb'), // Neighbor with Herbs
    },
    Herb: {
        name: 'Herb',
        texture: 'Herb',
        growthConditions: {
            waterLevel: 40,
            sunLevel: 50,
            neighborsNeeded: 2,
        },
        finalGrowthConditions: {
            waterLevel: 80,
            sunLevel: 60,
        },
        uniqueGrowthCondition: (field, neighbors) =>
            neighbors.filter(neighbor => neighbor.plantLevel > 0).length >= 2, // At least 2 neighbors with plants
    },
};

let shouldDisplayAutoSave = true;
// Function to move the player within the boundary
function movePlayer(dx, dy) {
    const farmer = this.farmer; // Use farmer sprite directly
    const boundary = {
        top: 50,
        right: this.cameras.main.width,
        bottom: this.cameras.main.height,
        left: 0,
    };

    // Update the player's position, ensuring it stays within the boundary
    if (farmer.x + dx >= boundary.left && farmer.x + dx <= boundary.right) {
        farmer.x += dx;
    }
    if (farmer.y + dy >= boundary.top && farmer.y + dy <= boundary.bottom) {
        farmer.y += dy;
    }
}

class Play extends Phaser.Scene {
    constructor() {
        super("playScene");
        this.fields = [];
        this.stage3Counter = 0;
        this.dayCounter = 0;
        this.undoStack = []; // Initialize undo stack
        this.redoStack = []; 
        
    }

    preload() {
        this.load.image('background', './assets/Background.png');
        this.load.image('field', './assets/Field.png');
        this.load.image('Sunflower', './assets/Sunflower1.png');
        this.load.image('Sunflower2', './assets/Sunflower2.png');
        this.load.image('Sunflower3', './assets/Sunflower3.png');
        this.load.image('Herb', './assets/Herb1.png');
        this.load.image('Herb2', './assets/Herb2.png');
        this.load.image('Herb3', './assets/Herb3.png');
        this.load.image('Mushroom', './assets/Mush1.png');
        this.load.image('Mushroom2', './assets/Mush2.png');
        this.load.image('Mushroom3', './assets/Mush3.png');
        this.load.image('farmer', './assets/farmer.png');

        this.load.json('en', 'assets/locales/en.json');
        this.load.json('es', 'assets/locales/es.json');
        this.load.json('zh', 'assets/locales/zh.json');
        this.load.json('ar', 'assets/locales/ar.json');
    }

    create() {

        this.keyA = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyW = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.input.keyboard.on('keydown-ONE', () => {
            this.loadGameState(1); // Load slot 1
        });
        
        this.input.keyboard.on('keydown-TWO', () => {
            this.loadGameState(2); // Load slot 2
        });
        
        this.input.keyboard.on('keydown-THREE', () => {
            this.loadGameState(3); // Load slot 3
        });

        let background = this.add.image(this.scale.width / 2, this.scale.height / 2, 'background');
        background.setScale(0.86, 0.86);

        const gridStartX = 60;
        const gridStartY = 240;
        const gridCols = 7;
        const gridRows = 4;
        const fieldSize = 64;
        let fieldIndex = 0;

        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const x = gridStartX + col * fieldSize;
                const y = gridStartY + row * fieldSize;
                let fieldSprite = this.add.image(x, y, 'field').setOrigin(0);
                fieldSprite.setScale(0.2, 0.2);
                fieldSprite.setInteractive();

                let field = {
                    index: fieldIndex,
                    sprite: fieldSprite,
                    waterLevel: 0,
                    sunLevel: 0,
                    plantLevel: 0
                };
                this.fields.push(field);
                fieldIndex++;

                fieldSprite.on('pointerdown', () => {
                    if (this.farmer) {
                        const distance = Phaser.Math.Distance.Between(
                            this.farmer.x,
                            this.farmer.y,
                            field.sprite.x + field.sprite.displayWidth / 2,
                            field.sprite.y + field.sprite.displayHeight / 2
                        );
                        const range = 130;
                        if (distance > range) {
                            console.log(`Field ${field.index} is out of range (${distance.toFixed(1)}px).`);
                            return;
                        }
                    }
                    this.handleFieldSelection(field);
                    this.showWaterAndSunText(field);
                });
            }
        }

        this.counterText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 6,
            `${Localization.get('stage3')}: ${this.stage3Counter}`,
            { font: '20px Arial' }
        );
        this.counterText.setOrigin(0.5, 1);

        this.farmer = this.add.sprite(75, 75, 'farmer');
        this.farmer.setScale(0.5, 0.5);

        this.dayText = this.add.text(
            50,
            this.cameras.main.height - 6,
            `${Localization.get('days')}: ${this.dayCounter}`,
            { font: '20px Arial' }
        );
        this.dayText.setOrigin(0.5, 1);

        this.nextDayButton = this.add.text(320, 20, Localization.get('next_day'), {
            fontSize: '20px',
            backgroundColor: '#21a99c',
            padding: { x: 20, y: 10 },
            align: 'center'
        }).setInteractive();
        this.nextDayButton.on('pointerdown', () => {
            this.dayCounter++;
            this.undoStack.push(this.getCurrentState());
            this.dayText?.setText(`${Localization.get('days')}: ${this.dayCounter}`);
            this.assignRandomLevels();
            this.saveGameState();
        });

        // Handle prompt for continuing previous game
        this.handleGameStatePrompt();

        // Save/Load buttons
        this.setupSaveLoadButtons();

        setInterval(() => {
            this.saveGameState();
            console.log("Game auto-saved");
        }, 60000);

        // Undo and Redo buttons
        this.setupUndoRedoButtons();

        this.undoStack.push(this.getCurrentState()); // Initialize undo stack

        // Listen for language changes and update texts
        document.addEventListener('languageChanged', this.updateLocalizedText.bind(this));
    }

    update() {
        const moveSpeed = 3;

    /*if (this.farmer) {
        if (this.keyA && this.keyA.isDown) {
            if (!this.movementTracked) { // Ensure state is only pushed once per movement
                this.undoStack.push(this.getCurrentState());
                this.movementTracked = true;
            }
            this.farmer.x -= moveSpeed;
        } else if (this.keyD && this.keyD.isDown) {
            if (!this.movementTracked) {
                this.undoStack.push(this.getCurrentState());
                this.movementTracked = true;
            }
            this.farmer.x += moveSpeed;
        } else if (this.keyW && this.keyW.isDown) {
            if (!this.movementTracked) {
                this.undoStack.push(this.getCurrentState());
                this.movementTracked = true;
            }
            this.farmer.y -= moveSpeed;
        } else if (this.keyS && this.keyS.isDown) {
            if (!this.movementTracked) {
                this.undoStack.push(this.getCurrentState());
                this.movementTracked = true;
            }
            this.farmer.y += moveSpeed;
        } else {
            this.movementTracked = false; // Reset when no movement
        }
    }*/

        if (this.farmer) {
            let dx = 0;
            let dy = 0;

            // Movement logic
            if (this.keyA.isDown) {
                dx = -moveSpeed; // Move left
            } else if (this.keyD.isDown) {
                dx = moveSpeed; // Move right
            } else if (this.keyW.isDown) {
                dy = -moveSpeed; // Move up
            } else if (this.keyS.isDown) {
                dy = moveSpeed; // Move down
            }

            // Track movement for undo/redo
            if (dx !== 0 || dy !== 0) {
                if (!this.movementTracked) {
                    this.undoStack.push(this.getCurrentState()); // Track state on first move
                    this.movementTracked = true;
                }
                movePlayer.call(this, dx, dy); // Move the player
            } else {
                this.movementTracked = false; // Reset when no movement
            }
        }
    
        // this is fthe original function
        if (this.fields && this.fields.length > 0) {
            this.fields.forEach(field => {
                const waterThreshold = 50;
                const sunThreshold = 50;
                const finalWaterThreshold = 100;
                const finalSunThreshold = 80;
    
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
            })
        }

            // this is the updated function
            /*if (this.fields && this.fields.length > 0) {
                this.fields.forEach(field => {
                    const plantType = field.plantType; // Retrieve the plant type
                    if (!plantType) return; // Skip fields with no plants
        
                    const neighborsWithPlants = this.getNeighbors(field).filter(neighbor => neighbor.plantLevel > 0).length;
        
                    // Check initial growth conditions
                    if (
                        field.waterLevel >= plantType.growthConditions.waterLevel &&
                        field.sunLevel >= plantType.growthConditions.sunLevel &&
                        neighborsWithPlants >= plantType.growthConditions.neighborsNeeded
                    ) {
                        if (field.plantLevel === 1) {
                            this.updatePlantTexture(field, 2);
                            field.waterLevel -= plantType.growthConditions.waterLevel;
                        }
                    }
        
                    // Check final growth conditions
                    if (
                        field.waterLevel >= plantType.finalGrowthConditions.waterLevel &&
                        field.sunLevel >= plantType.finalGrowthConditions.sunLevel
                    ) {
                        if (field.plantLevel === 2) {
                            this.updatePlantTexture(field, 3);
                            this.incrementCounter();
                            field.waterLevel -= plantType.finalGrowthConditions.waterLevel;
                        }
                    }
                });
            }*/
    
        if (this.stage3Counter >= 10) {
            this.winText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                `${Localization.get('you_win')}`,
                { font: '100px Arial', fontStyle: 'bold', color: '#21a99c' }
            );
            this.winText.setOrigin(0.5, 0.5);
        }
    }
    
    incrementCounter() {
        this.stage3Counter++;
        if (this.counterText) {
            this.counterText.setText(`${Localization.get('stage3')}: ${this.stage3Counter}`);
        }
        this.undoStack.push(this.getCurrentState());
    }

    assignRandomLevels() {
        this.fields.forEach(field => {
            field.waterLevel += Phaser.Math.Between(0, 10);
            field.sunLevel = Phaser.Math.Between(0, 100);
        });
        //console.log("Random levels assigned to fields:", this.fields);
    }

    handleFieldSelection(field) {
        // Deselect the previous field
        if (this.reapButton) this.reapButton.destroy();
        if (this.sowButton) this.sowButton.destroy();
        
        // Display Reap and Sow buttons
        const buttonY = field.sprite.y - 20;
        this.reapButton = this.add.text(field.sprite.x - 20, buttonY, Localization.get('reap'), {
            fontSize: '14px',
            backgroundColor: '#ff6666',
            padding: { x: 7, y: 3 },
        }).setInteractive();
    
        this.sowButton = this.add.text(field.sprite.x + 30, buttonY, Localization.get('sow'), {
            fontSize: '14px',
            backgroundColor: '#66cc66',
            padding: { x: 7, y: 3 },
        }).setInteractive();
    
        // Reap button functionality
        this.reapButton.on('pointerdown', () => {
            console.log(`Reaped field ${field.index}`);
            this.undoStack.push(this.getCurrentState()); // Save the current state before reaping
            field.sprite.setTexture('field');
            
            // Reset plant state
            if (field.plantLevel === 3) {
                this.stage3Counter--;
                this.counterText.setText(`${Localization.get('stage3')}: ${this.stage3Counter}`);
            }
            field.plantLevel = 0;
            this.saveGameState();
        });
    
        // Sow button functionality
        this.sowButton.on('pointerdown', () => {
            this.undoStack.push(this.getCurrentState()); // Save the current state before sowing
            this.showSowMenu(field);
            this.saveGameState();
        });
    
        // Close buttons if clicking outside
        this.input.on('pointerdown', (_pointer, currentlyOver) => {
            const clickedField = currentlyOver.find(obj => this.fields.some(field => field.sprite === obj));
            if (!clickedField) {
                if (this.reapButton) this.reapButton.destroy();
                if (this.sowButton) this.sowButton.destroy();
            }
            this.saveGameState();
        });
    }
    
    // these are the original functions 
    showSowMenu(field) {
        // Show plant choices near the selected field
        const sunflower = Localization.get('sunflower');
        const mushroom = Localization.get('mushroom');
        const herb = Localization.get('herb');

        const options = ['Sunflower', 'Mushroom', 'Herb'];
        const optionY = field.sprite.y - 20;
        const choiceTexts = [];
    
        options.forEach((key, index) => {
            const localizedText = Localization.get(key);

            // Create button for each option
            const choiceText = this.add.text(field.sprite.x + index * 80 - 80, optionY, localizedText, {
                fontSize: '12px',
                backgroundColor: '#358f39',
                padding: { x: 5, y: 2 },
            }).setInteractive();
            
            // Update field with selected plant
            choiceText.on('pointerdown', () => {
                console.log(`Planted ${key} on field ${field.index}`);
                field.sprite.setTexture(key);
                field.plantLevel = 1;
                choiceTexts.forEach(text => text.destroy());  // Remove plant choice buttons
                this.undoStack.push(this.getCurrentState());
            });
            choiceTexts.push(choiceText);
        });
    }
    
    reap(field) {
        if (field.plantLevel === 3) {
            this.undoStack.push(this.getCurrentState());
            field.plantLevel = 0;
            this.updatePlantTexture(field, 0);
            this.stage3Counter--;
            
            this.counterText?.setText(`${Localization.get('stage3')}: ${this.stage3Counter}`);
        } else {
            console.log(`No plant to reap in field ${field.index}`);
        }
    }

    sow(field) {
        if (field.plantLevel === 0) {
            // Create plant selection menu
            this.undoStack.push(this.getCurrentState());
            this.createPlantSelectionMenu(field);
            
        } else {
            console.log(`Field ${field.index} already has a plant`);
        }
    }

    updatePlantTexture(field, level) {
        let textureKey = '';
        console.log("key: " + field.sprite.texture.key);

        switch (level) {
            case 1:
                textureKey = this.getNextTexture(field.sprite.texture.key, 1);
                console.log("1");
                break;
            case 2:
                textureKey = this.getNextTexture(field.sprite.texture.key, 2);
                console.log("2");
                break;
            case 3:
                textureKey = this.getNextTexture(field.sprite.texture.key, 3);
                console.log("3");
                break;
        }

        if (textureKey) {
            field.sprite.setTexture(textureKey);
            field.plantLevel = level;
            console.log("sprite: " + field.sprite);
            console.log("Next stage: " + field.plantLevel);
            console.log("textureKey: " + textureKey);
        }
    }

    getNextTexture(currentTexture, stage) {
        const plantMap = {
            Sunflower: ['Sunflower', 'Sunflower2', 'Sunflower3'],
            Mushroom: ['Mushroom', 'Mushroom2', 'Mushroom3'],
            Herb: ['Herb', 'Herb2', 'Herb3'],
        };
    
        // Extract base name by removing any numbers at the end (e.g., "Sunflower2" -> "Sunflower")
        const baseTexture = currentTexture.replace(/\d+$/, '');
        console.log("Base texture: " + baseTexture);
    
        const plantTextures = plantMap[baseTexture];
        console.log("plantTextures before: " + plantTextures);
    
        if (!plantTextures) {
            console.error(`Texture key "${baseTexture}" not found in plantMap.`);
            return currentTexture; // Return the original texture if not found
        }
    
        // Check if the stage index is valid
        if (stage > 0 && stage <= plantTextures.length) {
            console.log("plantTextures after: " + plantTextures[stage - 1]);
            return plantTextures[stage - 1];
        }
    
        console.error(`Invalid stage "${stage}" for base texture "${baseTexture}".`);
        return currentTexture; // Return the original texture if stage is invalid
    }    
    

    getNeighbors(field) {
        const neighbors = [];
        const fieldIndex = field.index;
        const gridCols = 7;
        const gridRows = 4;
        const row = Math.floor(fieldIndex / gridCols);
        const col = fieldIndex % gridCols;
        if (!this.fields || this.fields.length === 0) {
            console.error('Fields array is empty or not initialized!');
            return neighbors;
        }
        // Check neighbors in 4 directions (up, down, left, right)
        if (row > 0) neighbors.push(this.fields[fieldIndex - gridCols]);
        if (row < gridRows - 1) neighbors.push(this.fields[fieldIndex + gridCols]);
        if (col > 0) neighbors.push(this.fields[fieldIndex - 1]);
        if (col < gridCols - 1) neighbors.push(this.fields[fieldIndex + 1]);
        return neighbors;
    }

        /*// these are updated functions
        showSowMenu(field) {
            // Show plant choices near the selected field
            const options = Object.keys(PlantTypes); // Dynamically fetch plant types
            const optionY = field.sprite.y - 20;
            const choiceTexts = [];
            
            options.forEach((key, index) => {
                const localizedText = Localization.get(key);
        
                // Create button for each option
                const choiceText = this.add.text(field.sprite.x + index * 80 - 80, optionY, localizedText, {
                    fontSize: '12px',
                    backgroundColor: '#358f39',
                    padding: { x: 5, y: 2 },
                }).setInteractive();
                
                // Update field with selected plant
                choiceText.on('pointerdown', () => {
                    console.log(`Planted ${key} on field ${field.index}`);
                    field.sprite.setTexture(PlantTypes[key].texture); // Use plant's texture from PlantTypes
                    field.plantLevel = 1;
                    choiceTexts.forEach(text => text.destroy()); // Remove plant choice buttons
                    this.undoStack.push(this.getCurrentState());
                });
                choiceTexts.push(choiceText);
            });
        }
        
        reap(field) {
            if (field.plantLevel === 3) {
                this.undoStack.push(this.getCurrentState());
                field.plantLevel = 0;
                this.updatePlantTexture(field, 0);
                this.stage3Counter--;
                
                this.counterText?.setText(`${Localization.get('stage3')}: ${this.stage3Counter}`);
            } else {
                console.log(`No plant to reap in field ${field.index}`);
            }
        }
        
        sow(field) {
            if (field.plantLevel === 0) {
                // Create plant selection menu
                this.undoStack.push(this.getCurrentState());
                this.showSowMenu(field); // Use the updated sow menu method
                
            } else {
                console.log(`Field ${field.index} already has a plant`);
            }
        }*/
        
        /*// new
        updatePlantTexture(field, level) {
            console.log("updatePlanttexture");
            const plantType = Object.values(PlantTypes).find(pt => pt.texture === field.sprite.texture.key);
            if (!plantType) {
                console.error(`Invalid texture key: ${field.sprite.texture.key}`);
                return;
            }
        
            const textureKey = this.getNextTexture(plantType.texture, level);
            if (textureKey) {
                field.sprite.setTexture(textureKey);
                field.plantLevel = level;
                console.log(`Field ${field.index} updated to stage ${level} with texture ${textureKey}`);
            }
        }*/

        // old 
        updatePlantTexture(field, level) {
            let textureKey = '';
            console.log("key: " + field.sprite.texture.key);
    
            switch (level) {
                case 1:
                    textureKey = this.getNextTexture(plantType.texture, level);
                    console.log("1");
                    break;
                case 2:
                    textureKey = this.getNextTexture(field.sprite.texture.key, level);
                    console.log("2");
                    break;
                case 3:
                    textureKey = this.getNextTexture(field.sprite.texture.key, level);
                    console.log("3");
                    break;
            }
    
            if (textureKey) {
                field.sprite.setTexture(textureKey);
                field.plantLevel = level;
                console.log("sprite: " + field.sprite);
                console.log("Next stage: " + field.plantLevel);
                console.log("textureKey: " + textureKey);
            }
        }

        /*// new
        getNextTexture(baseTexture, stage) {
            console.log("In getNextTexture function");
            const plantType = Object.values(PlantTypes).find(pt => pt.texture === baseTexture);
            if (!plantType) {
                console.error(`Texture key "${baseTexture}" not found in PlantTypes.`);
                return baseTexture;
            }
        
            const textures = [plantType.texture, `${plantType.texture}2`, `${plantType.texture}3`];
            return textures[stage - 1] || baseTexture; // Safeguard against invalid stages
        }*/
    
        // old
        getNextTexture(currentTexture, stage) {
            const plantMap = {
                Sunflower: ['Sunflower', 'Sunflower2', 'Sunflower3'],
                Mushroom: ['Mushroom', 'Mushroom2', 'Mushroom3'],
                Herb: ['Herb', 'Herb2', 'Herb3'],
            };
        
            // Extract base name by removing any numbers at the end (e.g., "Sunflower2" -> "Sunflower")
            const baseTexture = currentTexture.replace(/\d+$/, '');
            console.log("Base texture: " + baseTexture);
        
            const plantTextures = plantMap[baseTexture];
            console.log("plantTextures before: " + plantTextures);
        
            if (!plantTextures) {
                console.error(`Texture key "${baseTexture}" not found in plantMap.`);
                return currentTexture; // Return the original texture if not found
            }
        
            // Check if the stage index is valid
            if (stage > 0 && stage <= plantTextures.length) {
                console.log("plantTextures after: " + plantTextures[stage - 1]);
                return plantTextures[stage - 1];
            }
        
            console.error(`Invalid stage "${stage}" for base texture "${baseTexture}".`);
            return currentTexture; // Return the original texture if stage is invalid
        } 
        
        getNeighbors(field) {
            const neighbors = [];
            const fieldIndex = field.index;
            const gridCols = 7;
            const gridRows = 4;
            const row = Math.floor(fieldIndex / gridCols);
            const col = fieldIndex % gridCols;
        
            // Ensure fields array is valid
            if (!this.fields || this.fields.length === 0) {
                console.error('Fields array is empty or not initialized!');
                return neighbors;
            }
        
            // Check neighbors in 4 directions (up, down, left, right)
            if (row > 0) neighbors.push(this.fields[fieldIndex - gridCols]);
            if (row < gridRows - 1) neighbors.push(this.fields[fieldIndex + gridCols]);
            if (col > 0) neighbors.push(this.fields[fieldIndex - 1]);
            if (col < gridCols - 1) neighbors.push(this.fields[fieldIndex + 1]);
        
            return neighbors;
        } 
        // -------------------------------------------------------------------------------------------

    saveGameState() {
        /*const currentState = this.getCurrentState();
        this.undoStack.push(currentState);  // Always push the current state to undo stack
        localStorage.setItem('gameState', JSON.stringify(currentState));  // Save to localStorage
        //console.log("Game state saved", currentState);  // For debugging
        //this.redoStack = [];  // Clear redo stack after a new action*/

        const currentState = this.getCurrentState();
        if (JSON.stringify(this.undoStack[this.undoStack.length - 1]) !== JSON.stringify(currentState)) {
            this.undoStack.push(currentState);
        }
        localStorage.setItem('gameState', JSON.stringify(currentState));
    }
    
    getCurrentState() {
        return {
            fields: this.fields.map(field => ({
                index: field.index,
                plantLevel: field.plantLevel,
                waterLevel: field.waterLevel,
                sunLevel: field.sunLevel,
                plantTexture: field.sprite.texture.key  // Save the texture key as well
            })),
            farmerPosition: { x: this.farmer.x, y: this.farmer.y },
            dayCounter: this.dayCounter,
            stage3Counter: this.stage3Counter
        };
    }
    
    restoreState(state) {
        // Restore fields
        state.fields.forEach(savedField => {
            const field = this.fields[savedField.index];
            field.plantLevel = savedField.plantLevel;
            field.waterLevel = savedField.waterLevel;
            field.sunLevel = savedField.sunLevel;
            field.sprite.setTexture(savedField.plantTexture); // Restore texture
        });
    
        // Restore farmer position
        if (state.farmerPosition) {
            this.farmer.setPosition(state.farmerPosition.x, state.farmerPosition.y);
        }
    
        // Restore counters
        this.dayCounter = state.dayCounter || 0;
        this.stage3Counter = state.stage3Counter || 0;
    
        // Update UI
        this.counterText?.setText(`${Localization.get('stage3')}: ${this.stage3Counter}`);
        this.dayText?.setText(`${Localization.get('days')}: ${this.dayCounter}`);

        console.log("State restored:", state);
    }
    

    undo() {
        if (this.undoStack.length > 1) {
            console.log("undoStack length before: " + this.undoStack.length);
            const currentState = this.undoStack.pop(); // Remove the current state
            console.log("currentState length: " + this.undoStack.length);
            console.log("redo stack length before: " + this.redoStack.length);
            this.redoStack.push(currentState); // Save it to the redo stack
            console.log("redo stack length after: " + this.redoStack.length);
            const previousState = this.undoStack[this.undoStack.length - 1];
            this.restoreState(previousState); // Restore the previous state
            console.log("Undo performed", previousState);
        } else {
            console.log("Nothing to undo");
        }
    }
    
    redo() {
        console.log("redo stack in redo function: " + this.redoStack.length);
        if (this.redoStack.length > 0) {
            const redoState = this.redoStack.pop(); // Remove redo state
            this.undoStack.push(redoState); // Save it to the undo stack
            this.restoreState(redoState); // Restore the redo state
            console.log("Redo performed", redoState);
            console.log("Redo state: ", redoState);
        } else {
            console.log("Nothing to redo");
        }
    }
    
    
    handleGameStatePrompt() {
        const savedState = localStorage.getItem('gameState');
        if (savedState) {
            const promptText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 
                `${Localization.get('auto-save')}`, 
                { font: '20px Arial', color: '#ff0000', wordWrap: { width: 500 } }
            ).setOrigin(0.5, 0.5);
            if (promptText) {
                promptText.setText(`${Localization.get('auto-save')}`);
                console.log("Auto-save message: " + `${Localization.get('auto-save')}`);
            } 

            // Function to clear the HTML element's text
            const clearHtmlText = () => {
                const autoSaveElement = document.querySelector('[data-localize="auto-save"]');
                if (autoSaveElement) {
                    autoSaveElement.textContent = ''; // Clear the text
                }
            };
    
            this.input.keyboard.once('keydown-Y', () => {
                this.restoreState(JSON.parse(savedState)); // Load the saved state
                promptText.setText(`${Localization.get('loaded')}`);
                this.undoStack = [this.getCurrentState()]; // Reset undo stack after loading game state
                this.redoStack = []; // Clear redo stack
                shouldDisplayAutoSave = false;
                if (promptText) {
                    promptText.setText(`${Localization.get('loaded')}`);
                }

                this.time.delayedCall(1000, () => promptText.destroy());
                clearHtmlText();
            });
    
            this.input.keyboard.once('keydown-N', () => {
                localStorage.removeItem('gameState'); // Clear saved state
                promptText.setText(`${Localization.get('new')}`);
                this.undoStack = [this.getCurrentState()]; // Initialize undo stack for new game
                this.redoStack = []; // Reset redo stack
                shouldDisplayAutoSave = false;
                if (promptText) {
                    promptText.setText(`${Localization.get('new')}`);
                }
                this.time.delayedCall(1000, () => promptText.destroy());
                clearHtmlText();
            });

        } else {
            // Handle case for no saved state
            const promptText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 
                `${Localization.get('no-save2')}`, 
                { font: '20px Arial', color: '#ff0000', wordWrap: { width: 500 } }
            ).setOrigin(0.5, 0.5);
            
            this.undoStack = [this.getCurrentState()]; // Initialize undo stack for new game
            this.redoStack = []; // Initialize redo stack
            this.time.delayedCall(1000, () => promptText.destroy());
            
        }
    }
    
    
    setupSaveLoadButtons() {
        for (let slot = 1; slot <= 3; slot++) {
            const saveButton = this.add.text(320, 70 + (slot - 1) * 50, `${Localization.get('save')}: ${slot}`, {
                fontSize: '20px',
                backgroundColor: '#21a99c',
                padding: { x: 20, y: 10 },
                align: 'center'
            }).setInteractive();
    
            saveButton.on('pointerdown', () => {
                const currentState = this.getCurrentState();
                localStorage.setItem(`gameStateSlot${slot}`, JSON.stringify(currentState));
                console.log(`Game saved to slot ${slot}`);
                const promptText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2,
                    `${Localization.get('save')}: ${slot}`,
                    { font: '20px Arial', color: '#ffffff' }
                ).setOrigin(0.5, 0.5);
                if (promptText) {
                    promptText.setText(`${Localization.get('save')}: ${slot}`);
                }
                if (saveButton) {
                    saveButton.setText(`${Localization.get('save')}: ${slot}`);
                }
    
                this.time.delayedCall(1000, () => promptText.destroy()); // Remove text after 1 second
            });
        }
    
        // Load buttons for slots
        for (let slot = 1; slot <= 3; slot++) {
            this.loadButton = this.add.text(500, 70 + (slot - 1) * 50, `Load Slot ${slot}`, {
                fontSize: '20px',
                backgroundColor: '#21a99c',
                padding: { x: 20, y: 10 },
                align: 'center'
            }).setInteractive();
    
            this.loadButton.on('pointerdown', () => {
                this.loadGameState(slot);
            });
        }
    }

    setupUndoRedoButtons() {
        // Create Undo button
        this.undoButton = this.add.text(30, 20, Localization.get('undo'), {
            fontSize: '20px',
            backgroundColor: 'green',
            padding: { x: 20, y: 10 },
            align: 'center'
        }).setInteractive();
    
        this.undoButton.on('pointerdown', () => {
            this.undo();
            console.log("Undo action performed");
        });
    
        // Create Redo button
        this.redoButton = this.add.text(150, 20, Localization.get('redo'), {
            fontSize: '20px',
            backgroundColor: '#f0a500',
            padding: { x: 20, y: 10 },
            align: 'center'
        }).setInteractive();
    
        this.redoButton.on('pointerdown', () => {
            this.redo();
            console.log("Redo action performed");
        });
    }

    loadGameState(slot = 1) {
        const savedState = localStorage.getItem(`gameStateSlot${slot}`);
        if (savedState) {
            this.restoreState(JSON.parse(savedState)); // Restore the saved state
            console.log(`Game state loaded from slot ${slot}`);
            this.undoStack = [this.getCurrentState()];
            this.redoStack = [];
            const promptText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                `${Localization.get('load')} ${slot}`,
                { font: '20px Arial', color: '#ffffff' }
            ).setOrigin(0.5, 0.5);
            if (promptText) {
                promptText.setText(`${Localization.get('load')} ${slot}`);
            }


            this.time.delayedCall(1000, () => promptText.destroy()); // Remove text after 1 second
        } else {
            console.log(`No saved game found in slot ${slot}`);
            const promptText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                `${Localization.get('no-save')} ${slot}`,
                { font: '20px Arial', color: '#ff0000' }
            ).setOrigin(0.5, 0.5);
            if (promptText) {
                promptText.setText(`${Localization.get('load')} ${slot}`);
            }
            if (promptText) {
                this.promptText.setText(`${Localization.get('no-save2')}`);
            }

            this.time.delayedCall(1000, () => promptText.destroy()); // Remove text after 1 second
        }
    }
showWaterAndSunText(field) {
    if (this.waterText) {
        this.waterText.destroy();
    }
    if (this.sunText) {
        this.sunText.destroy();
    }
    this.waterText = this.add.text(
        20, 
        70, 
        `${Localization.get('water')}: ${field.waterLevel}`, 
        { font: '14px Arial', fill: 'white' }
    );

    // Display sun level text at a fixed position, just below the water level text
    this.sunText = this.add.text(
        20, 
        90, 
        `${Localization.get('sun')}: ${field.sunLevel}`,
        { font: '14px Arial', fill: 'white' }
    );
}

// Function to update localized texts in the game
updateLocalizedText() {
    if (this.dayText) {
        this.dayText.setText(`${Localization.get('days')}: ${this.dayCounter}`);
    }
    if (this.nextDayButton) {
        this.nextDayButton.setText(Localization.get('next_day'));
    }
    if (this.reapButton) {
        this.reapButton.setText(Localization.get('reap'));
    }
    if (this.sowButton) {
        this.sowButton.setText(Localization.get('sow'));
    }
    if (this.undoButton) {
        this.undoButton.setText(Localization.get('undo'));
    }
    if (this.redoButton) {
        this.redoButton.setText(Localization.get('redo'));
    }
    if (this.sunText) {
        this.sunText.setText(Localization.get('sun'));
    }
    if (this.waterText) {
        this.waterText.setText(Localization.get('water'));
    }
    if (this.counterText) {
        this.counterText.setText(`${Localization.get('stage3')} ${this.stage3Counter}`);
    }   
    if (this.winText) {
        this.winText.setText(`${Localization.get('you_win')}`);
    } 
}
}

// Localization.get('undo')
