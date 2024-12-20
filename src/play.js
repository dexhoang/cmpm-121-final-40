let shouldDisplayAutoSave = true;

class Play extends Phaser.Scene {

    constructor() {
        super("playScene");
        this.fields = [];
        this.stage3Counter = 0;
        this.dayCounter = 1;
        this.undoStack = []; // Initialize undo stack
        this.redoStack = []; 
        this.yamlData = null;
        this.parsedData = null;
        this.weatherAppliedToday = false;
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
        this.load.text('yamlData', './assets/myData.yaml');

        this.load.json('en', 'assets/locales/en.json');
        this.load.json('es', 'assets/locales/es.json');
        this.load.json('zh', 'assets/locales/zh.json');
        this.load.json('ar', 'assets/locales/ar.json');
    }

    create() {
        // Use js-yaml to parse the string into a JavaScript object
        this.yamlData = this.cache.text.get('yamlData');
        this.parsedData = jsyaml.load(this.yamlData);

        this.applyWeatherEffects();
        this.setupHtmlButtons();
        this.input.on('pointerdown', this.handleTapMovement, this);

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
        const gridStartY = 205;
        const gridCols = this.parsedData.starting_conditions.grid_cols;
        const gridRows = this.parsedData.starting_conditions.grid_rows;
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
                    plantLevel: 0,
                    plantType: null
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
            this.cameras.main.width / 2.4,
            this.cameras.main.height - 6,
            `${Localization.get('stage3')}: ${this.stage3Counter} / ${this.parsedData.victory_conditions.third_stage_plants}`,
            { font: '20px Arial' }
        );
        this.counterText.setOrigin(0.5, 1);

        this.farmer = this.add.sprite(140, 125, 'farmer');
        this.farmer.setScale(0.5, 0.5);

        this.dayText = this.add.text(
            50,
            this.cameras.main.height - 6,
            `${Localization.get('days')}: 1`,
            { font: '20px Arial' }
        );
        this.dayText.setOrigin(0.5, 1);

        this.nextDayButton = this.add.text().setInteractive();
        this.nextDayButton.on('pointerdown', () => {
            this.dayCounter++;
            this.undoStack.push(this.getCurrentState());
            this.dayText?.setText(`${Localization.get('days')}: ${this.dayCounter}`);
            this.assignRandomLevels();
            this.saveGameState();
            this.weatherAppliedToday = false;
        });

        // Weather Text Display
        this.weatherText = this.add.text(
            350,
            this.cameras.main.height -28,
            `${Localization.get('weather')}: ${Localization.get('Normal')}`,
            { font: "20px Arial", color: "#ffffff" }
        );

        // Handle prompt for continuing previous game
        this.handleGameStatePrompt();

        setInterval(() => {
            this.saveGameState();
            console.log("Game auto-saved");
        }, 60000);

        this.undoStack.push(this.getCurrentState()); // Initialize undo stack

        // Listen for language changes and update texts
        document.addEventListener('languageChanged', this.updateLocalizedText.bind(this));

        // Checks plant type's conditions
        class PlantType {
            constructor(name) {
                this.name = name;
                this.stageConditions = {};
            }
        
            setConditions(stage, conditions) {
                this.stageConditions[stage] = conditions;
                return this;
            }
        
            canGrow(field, neighbors, stage) {
                const conditions = this.stageConditions[stage];
                if (!conditions) {
                    console.warn(`No conditions defined for stage ${stage} of ${this.name}`);
                    return false;
                }
        
                // Check if all conditions for the stage are met
                return conditions.every(condition => {
                    switch (condition.type) {
                        case "water":
                            return this.compare(field.waterLevel, condition.operator, condition.value);
                        case "neighborPlantLevel":
                            return neighbors.some(n => 
                                this.compare(n.plantLevel, condition.operator, condition.value)
                            );
                        case "neighborSunLevel":
                            return neighbors.every(n => 
                                this.compare(n.sunLevel, condition.operator, condition.value)
                            );
                        default:
                            console.warn(`Unknown condition type: ${condition.type}`);
                            return false;
                    }
                });
            }
        
            compare(value, operator, target) {
                switch (operator) {
                    case ">": return value > target;
                    case ">=": return value >= target;
                    case "<": return value < target;
                    case "<=": return value <= target;
                    case "==": return value == target;
                    case "!=": return value != target;
                    default:
                        console.warn(`Unknown operator: ${operator}`);
                        return false;
                }
            }
        }
        
        // Create plant type
        class PlantTypeBuilder {
            constructor(name) {
                this.plantType = new PlantType(name);
            }
        
            setStageConditions(stage, conditions) {
                this.plantType.setConditions(stage, conditions);
                return this;
            }
        
            build() {
                return this.plantType;
            }
        }

        // Create plant types with conditions
        const Sunflower = new PlantTypeBuilder("Sunflower")
            .setStageConditions(2, [
                { type: "water", operator: ">", value: 50 }, // Needs water level > 50 
                { type: "neighborPlantLevel", operator: ">", value: 0 }, // Needs a neighbor plant level > 0
            ])
            .setStageConditions(3, [
                { type: "water", operator: ">", value: 100 }, // Needs water level > 50 
                { type: "neighborSunLevel", operator: ">", value: 20 }, // At least one neighbor needs to have sun level > 20
            ])
            .build();
    
        const Mushroom = new PlantTypeBuilder("Mushroom")
            .setStageConditions(2, [
                { type: "water", operator: ">", value: 30 }, // Needs water level > 30
                { type: "neighborSunLevel", operator: ">", value: 5 }, // All neighbors need to have sun level > 5
            ])
            .setStageConditions(3, [
                { type: "water", operator: ">", value: 60 }, // Needs water level > 60
                { type: "neighborSunLevel", operator: ">", value: 15 }, // All neighbors need to have sun level > 15
            ])
            .build();
        
        const Herb = new PlantTypeBuilder("Herb")
            .setStageConditions(2, [
                { type: "water", operator: ">", value: 20 }, // Needs water level > 20
                { type: "neighborPlantLevel", operator: "<=", value: 0 }, // At least one neighboring field without a plant
            ])
            .setStageConditions(3, [
                { type: "water", operator: ">", value: 50 }, // Needs water level > 50
            ])
            .build();

            this.plantRegistry = { Sunflower, Mushroom, Herb };
    }

    update() {
        const moveSpeed = 3; 

        this.fields.forEach(field => {
            if (field.plantType) {
                const neighbors = this.getNeighbors(field);
        
                if (field.plantLevel === 1 && field.plantType.canGrow(field, neighbors, 2)) {
                    console.log(`Field ${field.index}: Growing to Level 2`);
                    this.updatePlantTexture(field, 2);
                    field.plantLevel = 2;
                } else if (field.plantLevel === 2 && field.plantType.canGrow(field, neighbors, 3)) {
                    console.log(`Field ${field.index}: Growing to Level 3`);
                    this.updatePlantTexture(field, 3);
                    field.plantLevel = 3;
                    this.incrementCounter();
                } else {
                    console.log(`Field ${field.index}: Conditions not met for growth`);
                }
            }
        });
        
        
            
        if (this.farmer) {
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
        }

        this.applyWeatherEffects();

        if (this.stage3Counter >= this.parsedData.victory_conditions.third_stage_plants) {
            this.winText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                `${Localization.get('you_win')}`,
                { font: '100px Arial', fontStyle: 'bold', color: '#21a99c' }
            );
            this.winText.setOrigin(0.5, 0.5);
        }
    }

    applyWeatherEffects() {
        if (this.weatherAppliedToday) return; // Prevent applying weather effects more than once per day

        const weatherConditions = this.parsedData.weather_randomization;
        this.activeWeather = `${Localization.get('Normal')}`; // Default weather
    
        // Iterate through weather conditions from YAML
        Object.entries(weatherConditions).forEach(([weatherType, config]) => {
            if (config.isActive && this.dayCounter % config.interval === 0) {
                console.log(`Weather type active: ${weatherType}`);
                this.activeWeather = weatherType;
    
                // Apply the effects of the active weather type to the fields
                this.applyEffectsToFields(config.effects);
                console.log(config.effects);
            }
        });
    
        // Update the weather text to reflect the active weather
        if (this.weatherText) {
            this.weatherText.setText(`${Localization.get('weather')}: ${Localization.get(`${this.activeWeather}`)}`);
        }

        this.weatherAppliedToday = true; // Set flag after applying weather effects
    }
    
    applyEffectsToFields(effects) {
        this.fields.forEach((field) => {
            if (effects.sun_decrease) {
                field.sunLevel *= 1 - effects.sun_decrease;
            }
            if (effects.sun_increase) {
                field.sunLevel *= 1 + effects.sun_increase;
            }
            if (effects.water_decrease) {
                field.waterLevel *= 1 - effects.water_decrease;
            }
            if (effects.water_increase) {
                field.waterLevel *= 1 + effects.water_increase;
            }
            if (Math.random() > effects.plant_life) { // 20% chance to remove plants
                field.plantLevel = 1; // Remove the plant
                field.waterLevel = 0;
                field.sunLevel = 0;
                this.updatePlantTexture(field, 1);
                this.stage3Counter --;
                this.counterText.setText(`${Localization.get('stage3')}: ${this.stage3Counter} / ${this.parsedData.victory_conditions.third_stage_plants}`);
            }
            field.sunLevel = Math.round(field.sunLevel);
            field.waterLevel = Math.round(field.waterLevel);
        });
    
        console.log("Weather effects applied to fields:", effects);
    }

    
    incrementCounter() {
        this.stage3Counter++;
        if (this.counterText) {
            this.counterText.setText(`${Localization.get('stage3')}: ${this.stage3Counter} / ${this.parsedData.victory_conditions.third_stage_plants}`);
        }
        this.undoStack.push(this.getCurrentState());
    }

    assignRandomLevels() {
        this.fields.forEach(field => {
            field.waterLevel += Phaser.Math.Between(0, 10);
            field.sunLevel = Phaser.Math.Between(0, 100);
        });
    }

    handleFieldSelection(field) {
        // Log the field's current conditions
        console.log(`Field ${field.index} Conditions:`);
        console.log(`  Water Level: ${field.waterLevel}`);
        console.log(`  Sun Level: ${field.sunLevel}`);
        console.log(`  Plant Level: ${field.plantLevel}`);
        console.log(`  Plant Type: ${field.plantType ? field.plantType.name : "None"}`);
    
        // Log growing conditions if the plant type is assigned
        if (field.plantType) {
            // Log stage-specific conditions
            const stage = field.plantLevel + 1; // Determine the next growth stage
            const conditions = field.plantType.stageConditions[stage];
    
            if (conditions) {
                console.log(`  Growing Conditions for ${field.plantType.name}, Stage ${stage}:`);
                conditions.forEach((condition, i) => {
                    switch (condition.type) {
                        case "water":
                            console.log(`    Condition ${i + 1}: Water Level ${condition.operator} ${condition.value}`);
                            break;
                        case "neighborPlantLevel":
                            console.log(`    Condition ${i + 1}: Neighbor Plant Level ${condition.operator} ${condition.value}`);
                            break;
                        case "neighborSunLevel":
                            console.log(`    Condition ${i + 1}: Neighbor Sun Level ${condition.operator} ${condition.value}`);
                            break;
                        default:
                            console.log(`    Condition ${i + 1}: Unknown condition type (${condition.type})`);
                            break;
                    }
                });
            } else {
                console.log(`  No conditions defined for Stage ${stage} of ${field.plantType.name}`);
            }
        } else {
            console.log("  No plant type assigned to this field.");
        }
    
        // Log neighbor details
        const neighbors = this.getNeighbors(field);
        console.log(`  Neighbors (${neighbors.length} total):`);
        neighbors.forEach((neighbor, i) => {
            console.log(`    Neighbor ${i} - Plant Level: ${neighbor.plantLevel}, Sun Level: ${neighbor.sunLevel}, Water Level: ${neighbor.waterLevel}`);
        });
    
        // Existing functionality
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
                this.counterText.setText(`${Localization.get('stage3')}: ${this.stage3Counter} / ${this.parsedData.victory_conditions.third_stage_plants}`);
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
    
    
    
    showSowMenu(field) {
        const options = ['Sunflower', 'Mushroom', 'Herb'];
        const optionY = field.sprite.y - 20;
        const choiceTexts = [];
    
        options.forEach((plantName, index) => {
            const localizedText = Localization.get(plantName);
            const choiceText = this.add.text(
                field.sprite.x + index * 80 - 80,
                optionY,
                localizedText,
                {
                    fontSize: '12px',
                    backgroundColor: '#358f39',
                    padding: { x: 5, y: 2 },
                }
            ).setInteractive();
    
            choiceText.on('pointerdown', () => {
                console.log(`Planted ${plantName} on field ${field.index}`);
                field.plantType = this.plantRegistry[plantName]; // Use this.plantRegistry
                field.sprite.setTexture(plantName);
                field.plantLevel = 1;
                choiceTexts.forEach(text => text.destroy());
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
            
            this.counterText?.setText(`${Localization.get('stage3')}: ${this.stage3Counter} / ${this.parsedData.victory_conditions.third_stage_plants}`);
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
        const col = field.index % this.parsedData.starting_conditions.grid_cols; // Column index
        const row = Math.floor(field.index / this.parsedData.starting_conditions.grid_cols); // Row index
    
        // Define relative neighbor positions (N, S, E, W, NE, NW, SE, SW)
        const deltas = [
            { dx: -1, dy: 0 },  // West
            { dx: 1, dy: 0 },   // East
            { dx: 0, dy: -1 },  // North
            { dx: 0, dy: 1 },   // South
            { dx: -1, dy: -1 }, // Northwest
            { dx: 1, dy: -1 },  // Northeast
            { dx: -1, dy: 1 },  // Southwest
            { dx: 1, dy: 1 },   // Southeast
        ];
    
        deltas.forEach(delta => {
            const neighborCol = col + delta.dx;
            const neighborRow = row + delta.dy;
    
            // Ensure neighbor is within grid bounds
            if (
                neighborCol >= 0 &&
                neighborCol < this.parsedData.starting_conditions.grid_cols &&
                neighborRow >= 0 &&
                neighborRow < this.parsedData.starting_conditions.grid_rows
            ) {
                const neighborIndex = neighborRow * this.parsedData.starting_conditions.grid_cols + neighborCol;
                neighbors.push(this.fields[neighborIndex]); // Add the neighbor field
            }
        });
    
        return neighbors;
    }
    

    saveGameState(slot) {
        const currentState = this.getCurrentState(); // Get the current game state
        localStorage.setItem(`gameStateSlot${slot}`, JSON.stringify(currentState)); // Save to localStorage
    
        console.log(`Game saved to slot ${slot}`);
        if (JSON.stringify(this.undoStack[this.undoStack.length - 1]) !== JSON.stringify(currentState)) {
            this.undoStack.push(currentState);
        }
        localStorage.setItem('gameState', JSON.stringify(currentState));
    
        // Show visual feedback in HTML
        const saveButton = document.getElementById(`saveSlot${slot}`);
        if (saveButton) {
            saveButton.textContent = `${Localization.get('saving')}...`;
            saveButton.disabled = true; // Disable button during save
    
            // Simulate save delay for feedback
            setTimeout(() => {
                saveButton.textContent = `${Localization.get(`saveSlot${slot}`)}`;
                saveButton.disabled = false; // Re-enable button
            }, 1000);
        }
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
        this.counterText?.setText(`${Localization.get('stage3')}: ${this.stage3Counter} / ${this.parsedData.victory_conditions.third_stage_plants}`);
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
        this.scene.pause();
        const savedState = localStorage.getItem('gameState');
        const yesButton = document.getElementById('yes');
        const noButton = document.getElementById('no');
        const autoSaveElement = document.querySelector('[data-localize="auto-save"]');

        if (savedState) {
        const onYesClick = () => {
            const loadText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 
                `${Localization.get('loaded')}`, 
                { font: '20px Arial', color: '#ff0000', wordWrap: { width: 500 } }
            ).setOrigin(0.5, 0.5);

            this.restoreState(JSON.parse(savedState)); // Load the saved state
            loadText.setText(`${Localization.get('loaded')}`);
            this.undoStack = [this.getCurrentState()]; // Reset undo stack after loading game state
            this.redoStack = []; // Clear redo stack
            shouldDisplayAutoSave = false;
            if (loadText) {
                loadText.setText(`${Localization.get('loaded')}`);
            }
            this.scene.resume();

            this.time.delayedCall(1000, () => loadText.destroy());

            // Remove event listeners to prevent duplicate actions
            yesButton.removeEventListener('click', onYesClick);
            noButton.removeEventListener('click', onNoClick);
        };

        const onNoClick = () => {
            const newText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 
                `${Localization.get('auto-save')}`, 
                { font: '20px Arial', color: '#ff0000', wordWrap: { width: 500 } }
            ).setOrigin(0.5, 0.5);

            localStorage.removeItem('gameState'); // Clear saved state
            newText.setText(`${Localization.get('new')}`);
            this.undoStack = [this.getCurrentState()]; // Initialize undo stack for new game
            this.redoStack = []; // Reset redo stack
            shouldDisplayAutoSave = false;
            if (newText) {
                newText.setText(`${Localization.get('new')}`);
            }
            this.scene.resume();
            
            this.time.delayedCall(1000, () => newText.destroy());

            // Remove event listeners to prevent duplicate actions
            yesButton.removeEventListener('click', onYesClick);
            noButton.removeEventListener('click', onNoClick);
        };

        yesButton.addEventListener('click', onYesClick);
        noButton.addEventListener('click', onNoClick);

        } else {
            // Remove buttons and auto-save message
            if (yesButton) yesButton.style.display = 'none';
            if (noButton) noButton.style.display = 'none';
            if (autoSaveElement) autoSaveElement.style.display = 'none';
    
            this.scene.resume();
    
            // Handle case for no saved state
            const promptText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 
                `${Localization.get('no-save2')}`, 
                { font: '20px Arial', color: '#ff0000', wordWrap: { width: 500 } }
            ).setOrigin(0.5, 0.5);
            if (promptText) {
                promptText.setText(`${Localization.get('no-save2')}`);
            }
    
            this.undoStack = [this.getCurrentState()]; // Initialize undo stack for new game
            this.redoStack = []; // Initialize redo stack
            this.time.delayedCall(1000, () => promptText.destroy());
        }
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
        { font: '20px Arial', fill: 'white' }
    );

    // Display sun level text at a fixed position, just below the water level text
    this.sunText = this.add.text(
        20, 
        95, 
        `${Localization.get('sun')}: ${field.sunLevel}`,
        { font: '20px Arial', fill: 'white' }
    );

}

// Function to update localized texts in the game
updateLocalizedText() {

    if (this.dayText) {
        this.dayText.setText(`${Localization.get('days')}: ${this.dayCounter}`);
    }
    if (this.reapButton) {
        this.reapButton.setText(Localization.get('reap'));
    }
    if (this.sowButton) {
        this.sowButton.setText(Localization.get('sow'));
    }
    if (this.sunText) {
        this.sunText.setText(`${Localization.get('sun')}: ${field.sunLevel}`);
    }
    if (this.waterText) {
        this.waterText.setText(`${Localization.get('water')}: ${field.waterLevel}`);
    }
    if (this.counterText) {
        this.counterText.setText(`${Localization.get('stage3')}: ${this.stage3Counter} / ${this.parsedData.victory_conditions.third_stage_plants}`);
    }   
    if (this.winText) {
        this.winText.setText(`${Localization.get('you_win')}`);
    } 
    if (this.weatherText) {
        this.weatherText.setText(`${Localization.get('weather')}: ${Localization.get(`${this.activeWeather}`)}`);
    }
}

// Inside your scene or setup function
setupHtmlButtons() {
    // Reference the Phaser scene context
    const scene = this;

    // Localize all buttons with a "data-localize" attribute
    const buttons = document.querySelectorAll('[data-localize]');
    buttons.forEach(button => {
        const key = button.getAttribute('data-localize');
        const localizedText = Localization.get(key); // Fetch the localized string
        button.textContent = localizedText; // Update button text
    });

    // Reference the auto-save message element
    const autoSaveElement = document.querySelector('[data-localize="auto-save"]');
    const yesButton = document.getElementById('yes');
    const noButton = document.getElementById('no');

    // Add event listeners to the HTML buttons
    for (let slot = 1; slot <= 3; slot++) {
        document.getElementById(`loadSlot${slot}`).addEventListener('click', function () {
            scene.loadGameState(slot);
        });
    }

    document.getElementById('undo').addEventListener('click', function () {
        scene.undo();
    });
    document.getElementById('redo').addEventListener('click', function () {
        scene.redo();
    });
    
    for (let slot = 1; slot <= 3; slot++) {
        document.getElementById(`saveSlot${slot}`).addEventListener('click', function () {
            scene.saveGameState(slot);
        });
    }

    document.getElementById('next_day').addEventListener('click', function () {
        scene.dayCounter++; // Increment the day counter
        scene.undoStack.push(scene.getCurrentState());
        scene.assignRandomLevels();
        scene.saveGameState(); // Save the new game state
        scene.dayText.setText(`${Localization.get('days')}: ${scene.dayCounter}`); // Update day counter UI
        console.log('Next day triggered.');
        scene.weatherAppliedToday = false;
    });
    
    // Add event listeners to Yes and No buttons
    const hidePromptElements = () => {
        // Hide the auto-save message
        if (autoSaveElement) autoSaveElement.style.display = 'none';

        // Hide the Yes and No buttons
        if (yesButton) yesButton.style.display = 'none';
        if (noButton) noButton.style.display = 'none';
    };

    yesButton.addEventListener('click', function () {
        const savedState = localStorage.getItem('gameState');
        if (savedState) {
            scene.restoreState(JSON.parse(savedState)); // Restore saved state
            console.log('Yes button clicked: State restored');
        } else {
            console.log('Yes button clicked: No state to restore');
        }

        hidePromptElements(); // Hide elements after clicking "Yes"
    });

    noButton.addEventListener('click', function () {
        localStorage.removeItem('gameState'); // Clear saved state
        console.log('No button clicked: State cleared');

        hidePromptElements(); // Hide elements after clicking "No"
    });
}

handleTapMovement(pointer) {
    // Get the target position from the tap
    const targetX = pointer.worldX;
    const targetY = pointer.worldY;

    // Optional: Limit movement bounds to the game world
    const clampedX = Phaser.Math.Clamp(targetX, 0, this.game.config.width);
    const clampedY = Phaser.Math.Clamp(targetY, 0, this.game.config.height);

    // Calculate distance and duration for the movement
    const distance = Phaser.Math.Distance.Between(this.farmer.x, this.farmer.y, clampedX, clampedY);
    const duration = distance / 0.2; // Adjust speed by changing the divisor

    // Move farmer using Phaser's tween system
    this.tweens.add({
        targets: this.farmer,
        x: clampedX,
        y: clampedY,
        duration: duration,
        ease: 'Linear'
    });

    console.log(`Farmer moving to: (${clampedX}, ${clampedY})`);
}
}

// 