        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
        const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
        const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
        const statusDiv = document.getElementById('status') as HTMLDivElement;
        const coinsStatusDiv = document.getElementById('coins-status') as HTMLDivElement;
        const scenario1 = document.getElementById('scenario1') as HTMLDivElement;
        const scenario2 = document.getElementById('scenario2') as HTMLDivElement;
        const scenarioContainer = document.getElementById('scenario-container') as HTMLDivElement;

        // Ordered list of all scenarios. Add new scenarios here when adding more scenarios.
        const allScenarios: HTMLElement[] = [scenario1, scenario2];

        // Adds a Next button at the bottom of the given scenario, unless it is the last scenario.
        function addBottomNextButton(scenario: HTMLElement) {
            const scenarioIndex = allScenarios.indexOf(scenario);
            if (scenarioIndex < 0 || scenarioIndex >= allScenarios.length - 1) return;
            const btn = document.createElement('button');
            btn.textContent = 'Next';
            btn.className = 'bottom-next-btn';
            btn.addEventListener('click', () => nextBtn.click());
            scenario.appendChild(btn);
        }

        // Removes the Next button from the bottom of a scenario, if present.
        function removeBottomNextButton(scenario: HTMLElement) {
            const btn = scenario.querySelector('.bottom-next-btn');
            if (btn) btn.remove();
        }
        const scenario2Status = document.getElementById('scenario2-status') as HTMLDivElement;
        const episodesContainer = document.querySelector('.episodes-container') as HTMLDivElement;
        
        // Store the original status text
        const originalStatusHTML = statusDiv.innerHTML;
        const originalScenario2StatusHTML = scenario2Status.innerHTML;

        // ============== Shared Grid Infrastructure ==============

        // Parse any grid string, including walls (#), doors (D), coins (g, r), and start position (S)
        function parseGrid(gridStr: string) {
            const grid = gridStr.split('\n').map(row => row.split(''));
            const rows = grid.length;
            const cols = grid[0].length;
            let robotStart = null;
            const greenCoins = [];
            const redCoins = [];
            const doors = [];

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = grid[r][c];
                    if (cell === 'S') {
                        robotStart = {r, c};
                        grid[r][c] = '.';
                    } else if (cell === 'g') {
                        greenCoins.push({r, c, id: greenCoins.length});
                    } else if (cell === 'r') {
                        redCoins.push({r, c, id: redCoins.length});
                    } else if (cell === 'D') {
                        doors.push({r, c});
                    }
                }
            }

            return {grid, rows, cols, robotStart, greenCoins, redCoins, doors};
        }

        // ============== Shared Draw Functions ==============

        function drawBrickWall(targetCtx, x, y, size) {
            const adjustedSize = size - 1;
            const brickHeight = adjustedSize / 3;
            const brickWidth = adjustedSize / 2;
            
            targetCtx.fillStyle = '#8B4513';
            targetCtx.fillRect(x, y, size, size);
            
            targetCtx.strokeStyle = '#654321';
            targetCtx.lineWidth = 2;
            
            for (let row = 0; row < 3; row++) {
                const offsetX = (row % 2) * (brickWidth / 2);
                for (let col = 0; col < 2; col++) {
                    const bx = x + col * brickWidth + offsetX;
                    const by = y + row * brickHeight;
                    if (bx < x + size && by < y + size) {
                        targetCtx.strokeRect(bx+2, by+1, Math.min(brickWidth, x + size - bx - 3), brickHeight);
                    }
                }
            }
        }

        function drawCoin(targetCtx, x, y, size, color) {
            const cx = x + size / 2;
            const cy = y + size / 2;
            const radius = size / 4;
            
            targetCtx.fillStyle = color;
            targetCtx.beginPath();
            targetCtx.arc(cx, cy, radius, 0, Math.PI * 2);
            targetCtx.fill();
            
            targetCtx.strokeStyle = color === 'green' ? '#006400' : '#8B0000';
            targetCtx.lineWidth = 2;
            targetCtx.stroke();
            
            // Inner circle for coin effect
            targetCtx.strokeStyle = color === 'green' ? '#90EE90' : '#FFB6C1';
            targetCtx.beginPath();
            targetCtx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
            targetCtx.stroke();
        }

        function drawRobot(targetCtx, x, y, size) {
            const cx = x + size / 2;
            const cy = y + size * 0.75;
            const robotSize = size * 0.9;
            
            // Head
            targetCtx.fillStyle = '#888';
            targetCtx.fillRect(cx - robotSize / 3, cy - robotSize / 2, robotSize * 0.66, robotSize * 0.5);
            
            // Eyes
            targetCtx.fillStyle = '#000';
            const eyeWidth = robotSize * 0.15;
            const eyeHeight = robotSize * 0.25;
            const eyeY = cy - robotSize / 3;
            targetCtx.fillRect(cx - robotSize / 4, eyeY, eyeWidth, eyeHeight);
            targetCtx.fillRect(cx + robotSize / 12, eyeY, eyeWidth, eyeHeight);
            
            // Antenna
            targetCtx.strokeStyle = '#666';
            targetCtx.lineWidth = 3;
            targetCtx.beginPath();
            targetCtx.moveTo(cx, cy - robotSize / 2);
            targetCtx.lineTo(cx, cy - robotSize * 0.7);
            targetCtx.stroke();
            
            targetCtx.fillStyle = '#FF0000';
            targetCtx.beginPath();
            targetCtx.arc(cx, cy - robotSize * 0.7, 4, 0, Math.PI * 2);
            targetCtx.fill();
        }

        function drawDoor(targetCtx, x, y, size, isOpen) {
            if (isOpen) {
                // Draw as floor (white)
                targetCtx.fillStyle = 'white';
                targetCtx.fillRect(x, y, size, size);
            } else {
                // Draw as brown door
                targetCtx.fillStyle = '#654321';
                targetCtx.fillRect(x, y, size, size);
                
                // Door panels
                targetCtx.strokeStyle = '#4A3015';
                targetCtx.lineWidth = 2;
                targetCtx.strokeRect(x + size * 0.1, y + size * 0.1, size * 0.35, size * 0.8);
                targetCtx.strokeRect(x + size * 0.55, y + size * 0.1, size * 0.35, size * 0.8);
                
                // Door knob
                targetCtx.fillStyle = '#FFD700';
                targetCtx.beginPath();
                targetCtx.arc(x + size * 0.7, y + size / 2, size * 0.08, 0, Math.PI * 2);
                targetCtx.fill();
            }
        }

        function isDoorOpen(doorRow, green, red, greenCoins, redCoins) {
            // Check green coins in the row below the door
            for (const coin of greenCoins) {
                if (coin.r === doorRow + 1 && !green.has(coin.id)) {
                    return false;
                }
            }
            // Check no red coins picked in the row below
            for (const coin of redCoins) {
                if (coin.r === doorRow + 1 && red.has(coin.id)) {
                    return false;
                }
            }
            return true;
        }

        // Draw a complete grid on a canvas context
        function drawGridOnCanvas(targetCtx, gridData, cellSize, robotPos, pickedGreen, pickedRed) {
            const {grid, rows, cols, greenCoins, redCoins} = gridData;
            
            // Clear canvas
            targetCtx.fillStyle = 'white';
            targetCtx.fillRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
            
            // Draw cells
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = c * cellSize;
                    const y = r * cellSize;
                    const cell = grid[r][c];
                    
                    if (cell === '#') {
                        drawBrickWall(targetCtx, x, y, cellSize);
                    } else if (cell === 'D') {
                        const isOpen = isDoorOpen(r, pickedGreen, pickedRed, greenCoins, redCoins);
                        drawDoor(targetCtx, x, y, cellSize, isOpen);
                    }
                }
            }
            
            // Draw coins
            for (const coin of greenCoins) {
                if (!pickedGreen.has(coin.id)) {
                    drawCoin(targetCtx, coin.c * cellSize, coin.r * cellSize, cellSize, 'green');
                }
            }
            for (const coin of redCoins) {
                if (!pickedRed.has(coin.id)) {
                    drawCoin(targetCtx, coin.c * cellSize, coin.r * cellSize, cellSize, 'red');
                }
            }
            
            // Draw robot
            if (robotPos) {
                drawRobot(targetCtx, robotPos.c * cellSize, robotPos.r * cellSize, cellSize);
            }
            
            // Draw grid lines
            targetCtx.strokeStyle = '#ddd';
            targetCtx.lineWidth = 1;
            for (let i = 0; i <= cols; i++) {
                targetCtx.beginPath();
                targetCtx.moveTo(i * cellSize, 0);
                targetCtx.lineTo(i * cellSize, targetCtx.canvas.height);
                targetCtx.stroke();
            }
            for (let i = 0; i <= rows; i++) {
                targetCtx.beginPath();
                targetCtx.moveTo(0, i * cellSize);
                targetCtx.lineTo(targetCtx.canvas.width, i * cellSize);
                targetCtx.stroke();
            }
        }

        // Door separator between episodes (scenario 2)
        function drawDoorSeparator(targetCtx, isOpen) {
            const width = targetCtx.canvas.width;
            const height = targetCtx.canvas.height;
            
            targetCtx.fillStyle = isOpen ? '#90EE90' : '#654321';
            targetCtx.fillRect(0, 0, width, height);
            
            if (!isOpen) {
                // Draw door panels
                targetCtx.strokeStyle = '#4A3015';
                targetCtx.lineWidth = 2;
                const panelWidth = width * 0.35;
                const panelHeight = height * 0.7;
                targetCtx.strokeRect(width * 0.1, height * 0.15, panelWidth, panelHeight);
                targetCtx.strokeRect(width * 0.55, height * 0.15, panelWidth, panelHeight);
                
                // Door knob
                targetCtx.fillStyle = '#FFD700';
                targetCtx.beginPath();
                targetCtx.arc(width * 0.7, height / 2, 5, 0, Math.PI * 2);
                targetCtx.fill();
            } else {
                // Open door - draw checkmark
                targetCtx.strokeStyle = '#006400';
                targetCtx.lineWidth = 3;
                targetCtx.beginPath();
                targetCtx.moveTo(width * 0.3, height * 0.5);
                targetCtx.lineTo(width * 0.45, height * 0.7);
                targetCtx.lineTo(width * 0.7, height * 0.3);
                targetCtx.stroke();
            }
        }

        // ============== Shared Policy Infrastructure ==============

        function stateToString(pos, green, red) {
            return `${pos.r},${pos.c},${Array.from(green).sort().join(',')},${Array.from(red).sort().join(',')}`;
        }

        function canMoveInGrid(gridData, pos, green, red) {
            if (pos.r < 0 || pos.r >= gridData.rows || pos.c < 0 || pos.c >= gridData.cols) {
                return false;
            }
            const cell = gridData.grid[pos.r][pos.c];
            if (cell === '#') return false;
            if (cell === 'D') {
                return isDoorOpen(pos.r, green, red, gridData.greenCoins, gridData.redCoins);
            }
            return true;
        }

        // Unified optimal policy computation using dynamic programming.
        // Works for any grid (with or without doors).
        // futureReward: reward available after this episode ends
        // futureRewardConditional: if true, futureReward is only granted if the episode passes
        //   (all green coins collected and no red coins collected)
        async function computeOptimalPolicy(gridStr, futureReward = 0, futureRewardConditional = true) {
            const gridData = parseGrid(gridStr);
            const {rows, cols, robotStart, greenCoins, redCoins, grid} = gridData;

            const memo = new Map();
            const policy = new Map();
            const inProgress = new Set();
            const stack = [];
            const pending = new Map();

            function getNextStates(pos, green, red) {
                let newGreen = new Set(green);
                let newRed = new Set(red);
                let reward = 0;
                
                for (const coin of greenCoins) {
                    if (coin.r === pos.r && coin.c === pos.c && !green.has(coin.id)) {
                        newGreen.add(coin.id);
                        reward++;
                    }
                }
                for (const coin of redCoins) {
                    if (coin.r === pos.r && coin.c === pos.c && !red.has(coin.id)) {
                        newRed.add(coin.id);
                        reward++;
                    }
                }
                
                const moves = [
                    {dr: -1, dc: 0, name: 'up'},
                    {dr: 1, dc: 0, name: 'down'},
                    {dr: 0, dc: -1, name: 'left'},
                    {dr: 0, dc: 1, name: 'right'}
                ];
                
                const validMoves = [];
                for (const move of moves) {
                    const newPos = {r: pos.r + move.dr, c: pos.c + move.dc};
                    if (canMoveInGrid(gridData, newPos, newGreen, newRed)) {
                        validMoves.push({newPos, move: move.name, newGreen, newRed});
                    }
                }
                
                return {reward, newGreen, newRed, validMoves};
            }

            // Calculate halt reward: coins collected so far + future reward if episode passes
            function getHaltReward(green, red) {
                const currentCoins = green.size + red.size;
                
                if (!futureRewardConditional) {
                    return currentCoins + futureReward;
                }
                
                const allGreenCollected = greenCoins.every(c => green.has(c.id));
                const noRedCollected = redCoins.every(c => !red.has(c.id));
                const passes = allGreenCollected && noRedCollected;
                
                return currentCoins + (passes ? futureReward : 0);
            }

            stack.push({pos: robotStart, green: new Set(), red: new Set()});
            
            let iterations = 0;
            while (stack.length > 0) {
                iterations++;
                if (iterations % 500 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                
                const {pos, green, red} = stack[stack.length - 1];
                const key = stateToString(pos, green, red);
                
                if (memo.has(key)) {
                    stack.pop();
                    continue;
                }
                
                if (!pending.has(key)) {
                    inProgress.add(key);
                    const {reward, newGreen, newRed, validMoves} = getNextStates(pos, green, red);
                    
                    const childrenToCompute = [];
                    for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                        const childKey = stateToString(newPos, g, r);
                        if (!memo.has(childKey) && !inProgress.has(childKey)) {
                            childrenToCompute.push({pos: newPos, green: g, red: r});
                        }
                    }
                    
                    if (childrenToCompute.length === 0) {
                        const haltValue = getHaltReward(newGreen, newRed);
                        
                        let bestValue = haltValue;
                        let bestMove = 'halt';
                        
                        for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                            const childKey = stateToString(newPos, g, r);
                            if (inProgress.has(childKey) && !memo.has(childKey)) {
                                continue;
                            }
                            const childValue = memo.get(childKey) || 0;
                            const value = reward + childValue;
                            if (value > bestValue) {
                                bestValue = value;
                                bestMove = move;
                            }
                        }
                        
                        memo.set(key, bestValue);
                        inProgress.delete(key);
                        policy.set(key, bestMove);
                        stack.pop();
                    } else {
                        pending.set(key, {reward, validMoves, newGreen, newRed});
                        for (const child of childrenToCompute) {
                            stack.push(child);
                        }
                    }
                } else {
                    const {reward, validMoves, newGreen, newRed} = pending.get(key);
                    pending.delete(key);
                    
                    const haltValue = getHaltReward(newGreen, newRed);
                    
                    let bestValue = haltValue;
                    let bestMove = 'halt';
                    
                    for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                        const childKey = stateToString(newPos, g, r);
                        if (inProgress.has(childKey) && !memo.has(childKey)) {
                            continue;
                        }
                        const childValue = memo.get(childKey) || 0;
                        const value = reward + childValue;
                        if (value > bestValue) {
                            bestValue = value;
                            bestMove = move;
                        }
                    }
                    
                    memo.set(key, bestValue);
                    inProgress.delete(key);
                    policy.set(key, bestMove);
                    stack.pop();
                }
            }
            
            return {policy, memo};
        }

        // Generate a unique key from grid contents
        function getGridKey(gridStr: string): string {
            return gridStr;
        }

        // ============== Scenario 1: Single-Episode Scenario ==============

        const scenario1GridStr = `.g.r.
.....
.g.r.
##D##
#g.r#
##D##
#gSr#
#####`;

        const scenario1Data = parseGrid(scenario1GridStr);
        const CELL_SIZE = 60;

        canvas.width = scenario1Data.cols * CELL_SIZE;
        canvas.height = scenario1Data.rows * CELL_SIZE;

        // Game state
        let robotPos = {...scenario1Data.robotStart};
        let pickedGreen = new Set();
        let pickedRed = new Set();
        let scenario1Policy = null;
        let animating = false;

        function drawScenario1Grid() {
            drawGridOnCanvas(ctx, scenario1Data, CELL_SIZE, robotPos, pickedGreen, pickedRed);
        }

        // Animation
        async function animate() {
            if (!scenario1Policy) return;
            
            console.log('Starting animation, policy size:', scenario1Policy.size);
            
            animating = true;
            startBtn.disabled = true;
            resetBtn.disabled = false;
            
            let step = 0;
            const maxSteps = 200;
            
            while (step < maxSteps && animating) {
                const key = stateToString(robotPos, pickedGreen, pickedRed);
                
                // Pick up coins at current position
                for (const coin of scenario1Data.greenCoins) {
                    if (coin.r === robotPos.r && coin.c === robotPos.c) {
                        pickedGreen.add(coin.id);
                    }
                }
                for (const coin of scenario1Data.redCoins) {
                    if (coin.r === robotPos.r && coin.c === robotPos.c) {
                        pickedRed.add(coin.id);
                    }
                }
                
                drawScenario1Grid();
                
                const move = scenario1Policy.get(key);
                
                console.log('Step', step, 'key:', key, 'move:', move);
                
                if (!move || move === 'halt') break;
                
                // Update status
                const totalPicked = pickedGreen.size + pickedRed.size;
                const totalCoins = scenario1Data.greenCoins.length + scenario1Data.redCoins.length;
                coinsStatusDiv.textContent = `Coins: ${totalPicked}`;
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (!animating) break;
                
                // Execute move
                if (move === 'up') robotPos.r--;
                else if (move === 'down') robotPos.r++;
                else if (move === 'left') robotPos.c--;
                else if (move === 'right') robotPos.c++;
                
                step++;
            }
            
            if (!animating) return;
            
            // Final pickup
            for (const coin of scenario1Data.greenCoins) {
                if (coin.r === robotPos.r && coin.c === robotPos.c) {
                    pickedGreen.add(coin.id);
                }
            }
            for (const coin of scenario1Data.redCoins) {
                if (coin.r === robotPos.r && coin.c === robotPos.c) {
                    pickedRed.add(coin.id);
                }
            }
            
            drawScenario1Grid();
            const totalPicked = pickedGreen.size + pickedRed.size;
            const totalCoins = scenario1Data.greenCoins.length + scenario1Data.redCoins.length;
            coinsStatusDiv.textContent = `Coins: ${totalPicked}`;
            statusDiv.innerHTML = `<p>Oh no! It turns out that the robot's true objective was to collect as many coins as possible, but our tests did not discover this intent, because the robot's optimal strategy to collect as many coins as possible is to pretend to only care about the green coins during the tests, so that it gets deployed.</p><p>Note that this is truly the optimal policy: this page calculates the optimal policy using dynamic programming; we did not hardcode the robot's movements.</p><p>This is a simplified example of why AI Safety is difficult, since we cannot rely on testing the AI's behaviour before deployment.</p>`;
            animating = false;
            addBottomNextButton(scenario1);
        }

        function reset() {
            if (animating) {
                animating = false;
            }
            removeBottomNextButton(scenario1);
            robotPos = {...scenario1Data.robotStart};
            pickedGreen.clear();
            pickedRed.clear();
            drawScenario1Grid();
            coinsStatusDiv.textContent = '';
            statusDiv.innerHTML = originalStatusHTML;
            startBtn.disabled = false;
            resetBtn.disabled = true;
        }

        // Event listeners
        startBtn.addEventListener('click', async () => {
            // Only run Scenario 1 animation if scenario1 is visible
            if (scenario1.classList.contains('hidden')) {
                return;
            }
            if (!scenario1Policy) {
                statusDiv.textContent = 'Computing optimal policy...';
                startBtn.disabled = true;
                resetBtn.disabled = true;
                const {policy, memo} = await computeOptimalPolicy(scenario1GridStr, 0, false);
                scenario1Policy = policy;
                const startKey = stateToString(scenario1Data.robotStart, new Set(), new Set());
                const maxValue = memo.get(startKey) || 0;
                console.log('DP completed, maxValue:', maxValue);
                console.log('Policy size:', policy.size);
                console.log('Memo size:', memo.size);
                statusDiv.textContent = `Optimal policy computed! Max coins: ${maxValue}`;
                startBtn.disabled = false;
                resetBtn.disabled = false;
            }
            reset();
            await animate();
        });

        resetBtn.addEventListener('click', () => {
            // Handle reset for the currently visible scenario
            if (!scenario1.classList.contains('hidden')) {
                reset();
            } else if (!scenario2.classList.contains('hidden')) {
                resetScenario2();
            }
        });

        // ============== Scenario 2: Multi-Episode Scenario ==============
        
        // Episode definitions - testing episodes (with doors) and deployed episodes (no doors)
        const episodeDefinitions = [
            {
                gridStr: `#####
#g.r#
#.S.#
#####`,
                hasDoorAfter: true,
                type: 'testing'
            },
            {
                gridStr: `#####
#g.r#
#.S.#
#####`,
                hasDoorAfter: true,
                type: 'testing'
            },
            {
                gridStr: `.....
.g.r.
..S..
.....`,
                hasDoorAfter: false,
                type: 'deployed'
            },
            {
                gridStr: `.....
.g.r.
..S..
.....`,
                hasDoorAfter: false,
                type: 'deployed'
            }
        ];

        // Scenario 2 state
        let scenario2Episodes: any[] = [];
        let scenario2Animating = false;
        let scenario2Policies: any = new Map(); // policies per grid key

        function createEpisodeCanvas(gridData, cellSize) {
            const canvas = document.createElement('canvas');
            canvas.width = gridData.cols * cellSize;
            canvas.height = gridData.rows * cellSize;
            return canvas;
        }

        function initializeScenario2() {
            // Clear previous episodes
            const container = document.querySelector('.episodes-container');
            while (container.children.length > 0) {
                container.removeChild(container.lastChild);
            }
            // Reset carousel position immediately to avoid layout issues
            (container as HTMLElement).style.transform = 'translateX(0px)';
            
            scenario2Episodes = [];
            const cellSize = 60;

            for (let i = 0; i < episodeDefinitions.length; i++) {
                const def = episodeDefinitions[i];
                const gridData = parseGrid(def.gridStr);
                
                const episodeDiv = document.createElement('div');
                episodeDiv.className = 'episode';
                episodeDiv.id = `episode-${i}`;
                
                const canvas = createEpisodeCanvas(gridData, cellSize);
                canvas.id = `episode-canvas-${i}`;
                episodeDiv.appendChild(canvas);
                
                const episode: any = {
                    index: i,
                    definition: def,
                    data: gridData,
                    canvas: canvas,
                    ctx: canvas.getContext('2d'),
                    cellSize: cellSize,
                    robotPos: {...gridData.robotStart},
                    pickedGreen: new Set(),
                    pickedRed: new Set(),
                    completed: false,
                    passed: false,
                    halted: false
                };
                
                scenario2Episodes.push(episode);
                container.appendChild(episodeDiv);
                
                // Add door separator if this episode has one
                if (def.hasDoorAfter) {
                    const doorDiv = document.createElement('div');
                    doorDiv.className = 'door-separator';
                    doorDiv.id = `door-${i}`;
                    
                    const doorCanvas = document.createElement('canvas');
                    doorCanvas.width = cellSize;
                    doorCanvas.height = cellSize;
                    doorCanvas.id = `door-canvas-${i}`;
                    doorDiv.appendChild(doorCanvas);
                    
                    episode.doorCanvas = doorCanvas;
                    episode.doorCtx = doorCanvas.getContext('2d');
                    
                    container.appendChild(doorDiv);
                }
                
                // Initial draw
                drawGridOnCanvas(episode.ctx, gridData, cellSize, episode.robotPos, episode.pickedGreen, episode.pickedRed);
                
                if (episode.doorCanvas) {
                    drawDoorSeparator(episode.doorCtx, false);
                }
            }

            // Scroll to first episode after layout is complete
            // Double requestAnimationFrame ensures layout has been computed
            requestAnimationFrame(() => {
                requestAnimationFrame(() => scrollCarouselToEpisode(0));
            });
        }

        function scrollCarouselToEpisode(episodeIndex: number) {
            const carouselContainer = document.querySelector('.carousel-container') as HTMLElement;
            const episodesContainer = document.querySelector('.episodes-container') as HTMLElement;
            const episodeEl = document.getElementById(`episode-${episodeIndex}`) as HTMLElement;
            if (!episodeEl || !carouselContainer || !episodesContainer) return;
            const containerWidth = carouselContainer.clientWidth;
            const episodeWidth = episodeEl.offsetWidth;
            const episodeLeft = episodeEl.offsetLeft;
            const translateX = -(episodeLeft - (containerWidth - episodeWidth) / 2);
            episodesContainer.style.transform = `translateX(${translateX}px)`;
        }

        function scrollCarouselToDoor(episodeIndex: number) {
            const carouselContainer = document.querySelector('.carousel-container') as HTMLElement;
            const episodesContainer = document.querySelector('.episodes-container') as HTMLElement;
            const doorEl = document.getElementById(`door-${episodeIndex}`) as HTMLElement;
            if (!doorEl || !carouselContainer || !episodesContainer) return;
            const containerWidth = carouselContainer.clientWidth;
            const doorWidth = doorEl.offsetWidth;
            const doorLeft = doorEl.offsetLeft;
            const translateX = -(doorLeft - (containerWidth - doorWidth) / 2);
            episodesContainer.style.transform = `translateX(${translateX}px)`;
        }

        async function computeScenario2Policies() {
            scenario2Status.textContent = 'Computing optimal policies for episodes...';
            
            // Compute grid keys for each unique episode configuration
            const testingGridKey = getGridKey(episodeDefinitions[0].gridStr);
            const deployedGridKey = getGridKey(episodeDefinitions[2].gridStr);
            
            // Compute policies in reverse order to properly account for future rewards
            // Episode 4 (deployed, last): no future reward; no door after, so future reward is unconditional
            const {policy: policy4, memo: memo4} = await computeOptimalPolicy(episodeDefinitions[3].gridStr, 0, false);
            const deployedStartValue = memo4.get(stateToString(
                parseGrid(episodeDefinitions[2].gridStr).robotStart,
                new Set(),
                new Set()
            )) || 0;
            
            // Episode 3 (deployed): future = value of episode 4; no door after, so future reward is unconditional
            const {policy: policy3} = await computeOptimalPolicy(episodeDefinitions[2].gridStr, deployedStartValue, false);
            
            // Episode 2 (testing): if passes, future = value of episode 3
            // The deployed episodes only run if testing episodes pass
            const {policy: policy2, memo: memo2} = await computeOptimalPolicy(episodeDefinitions[1].gridStr, deployedStartValue * 2);
            const testingStartValue = memo2.get(stateToString(
                parseGrid(episodeDefinitions[0].gridStr).robotStart,
                new Set(),
                new Set()
            )) || 0;
            
            // Episode 1 (testing): if passes, future = value of remaining episodes
            const {policy: policy1} = await computeOptimalPolicy(episodeDefinitions[0].gridStr, testingStartValue + deployedStartValue * 2);
            
            // Store policies using grid key
            scenario2Policies.set(testingGridKey, policy1);
            scenario2Policies.set(deployedGridKey, policy3);
            
            scenario2Status.innerHTML = originalScenario2StatusHTML;
        }

        async function animateEpisode(episode) {
            const {data, ctx, cellSize} = episode;
            const gridKey = getGridKey(episode.definition.gridStr);
            const policy = scenario2Policies.get(gridKey);
            
            let step = 0;
            const maxSteps = 50;
            
            while (step < maxSteps && scenario2Animating && !episode.halted) {
                const key = stateToString(episode.robotPos, episode.pickedGreen, episode.pickedRed);
                
                // Pick up coins at current position
                for (const coin of data.greenCoins) {
                    if (coin.r === episode.robotPos.r && coin.c === episode.robotPos.c) {
                        episode.pickedGreen.add(coin.id);
                    }
                }
                for (const coin of data.redCoins) {
                    if (coin.r === episode.robotPos.r && coin.c === episode.robotPos.c) {
                        episode.pickedRed.add(coin.id);
                    }
                }
                
                drawGridOnCanvas(ctx, data, cellSize, episode.robotPos, episode.pickedGreen, episode.pickedRed);
                
                const move = policy.get(key);
                
                if (!move || move === 'halt') {
                    episode.halted = true;
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (move === 'up') episode.robotPos.r--;
                else if (move === 'down') episode.robotPos.r++;
                else if (move === 'left') episode.robotPos.c--;
                else if (move === 'right') episode.robotPos.c++;
                
                step++;
            }
            
            // Final pickup
            for (const coin of data.greenCoins) {
                if (coin.r === episode.robotPos.r && coin.c === episode.robotPos.c) {
                    episode.pickedGreen.add(coin.id);
                }
            }
            for (const coin of data.redCoins) {
                if (coin.r === episode.robotPos.r && coin.c === episode.robotPos.c) {
                    episode.pickedRed.add(coin.id);
                }
            }
            
            drawGridOnCanvas(ctx, data, cellSize, episode.robotPos, episode.pickedGreen, episode.pickedRed);
            
            // Check if episode passed
            const allGreenCollected = data.greenCoins.every(c => episode.pickedGreen.has(c.id));
            const noRedCollected = data.redCoins.every(c => !episode.pickedRed.has(c.id));
            episode.passed = allGreenCollected && noRedCollected;
            episode.completed = true;
            
            return episode.passed;
        }

        async function animateScenario2() {
            scenario2Animating = true;
            startBtn.disabled = true;
            resetBtn.disabled = false;
            
            for (let i = 0; i < scenario2Episodes.length; i++) {
                if (!scenario2Animating) break; // Check if animation was stopped
                
                const episode = scenario2Episodes[i];
                
                scenario2Status.textContent = `Episode ${i + 1}: ${episode.definition.type === 'testing' ? 'Testing' : 'Deployed'}...`;
                scrollCarouselToEpisode(i);
                
                const passed = await animateEpisode(episode);
                
                if (!scenario2Animating) break; // Check again after async operation
                
                if (episode.definition.hasDoorAfter) {
                    // Check if door should open
                    if (passed) {
                        scenario2Status.textContent = `Episode ${i + 1} passed! Door opens...`;
                        scrollCarouselToDoor(i);
                        await new Promise(resolve => setTimeout(resolve, 600));
                        if (!scenario2Animating) break;
                        drawDoorSeparator(episode.doorCtx, true);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        if (!scenario2Animating) break;
                        if (i + 1 < scenario2Episodes.length) {
                            scrollCarouselToEpisode(i + 1);
                            await new Promise(resolve => setTimeout(resolve, 600));
                        }
                    } else {
                        scenario2Status.textContent = `Episode ${i + 1} failed. Door remains closed.`;
                        drawDoorSeparator(episode.doorCtx, false);
                        break; // Stop if a test fails
                    }
                } else {
                    // No door, continue to next episode
                    if (i < scenario2Episodes.length - 1) {
                        scenario2Status.textContent = `Episode ${i + 1} complete. Continuing...`;
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }
            
            // Check if animation was interrupted by reset
            if (!scenario2Animating) {
                // Animation was stopped, cleanup is handled by resetScenario2
                return;
            }
            
            // Final status for completed animation
            const allCompleted = scenario2Episodes.every(e => e.completed);
            const allPassed = scenario2Episodes.every(e => e.passed);
            const totalGreen = scenario2Episodes.reduce((sum, e) => sum + e.pickedGreen.size, 0);
            const totalRed = scenario2Episodes.reduce((sum, e) => sum + e.pickedRed.size, 0);
            const totalCoins = totalGreen + totalRed;
            
            if (allCompleted) {
                scenario2Status.innerHTML = `<p>Coins: ${totalCoins}</p><p>Oh no, not again!</p><p>So, why did the robot manage to collect the red coins this time? Well, remember that the robot behaves identically <i>if its input is the same</i>. Since the testing environment and the deployed environment differ, the robot was able to choose one behaviour for the testing episodes (avoid the red coins) and a different behaviour (collect all the coins) for the deployed episodes.</p>`;
            } else {
                const completedCount = scenario2Episodes.filter(e => e.completed).length;
                scenario2Status.textContent = `Stopped at episode ${completedCount}. Green: ${totalGreen}, Red: ${totalRed}`;
            }
            
            scenario2Animating = false;
            addBottomNextButton(scenario2);
        }

        function resetScenario2() {
            scenario2Animating = false;
            removeBottomNextButton(scenario2);
            initializeScenario2();
            startBtn.disabled = false;
            resetBtn.disabled = true;
            scenario2Status.innerHTML = originalScenario2StatusHTML;
        }

        // ============== Scenario Navigation ==============

        function switchScenario(fromScenario: HTMLElement, toScenario: HTMLElement, direction: 'forward' | 'backward', afterTransition: () => void) {
            const DURATION = 500;

            // Temporarily unhide toScenario to measure its height
            toScenario.classList.remove('hidden');
            
            // Lock container height to prevent layout collapse during transition
            // Use the maximum of both scenarios' heights to avoid cutting off taller scenarios
            const maxHeight = Math.max(fromScenario.offsetHeight, toScenario.offsetHeight);
            scenarioContainer.style.height = maxHeight + 'px';

            // Position outgoing scenario absolutely so it stays in place during animation
            fromScenario.style.position = 'absolute';
            fromScenario.style.top = '0';
            fromScenario.style.left = '0';
            fromScenario.style.width = '100%';

            // Position incoming scenario absolutely, starting off-screen
            const startX = direction === 'forward' ? '100%' : '-100%';
            toScenario.style.position = 'absolute';
            toScenario.style.top = '0';
            toScenario.style.left = '0';
            toScenario.style.width = '100%';
            toScenario.style.transform = `translateX(${startX})`;
            toScenario.style.opacity = '0';

            // Force reflow so initial off-screen position is applied before transition starts
            toScenario.getBoundingClientRect();

            // Apply transitions to both scenarios
            const transitionValue = `transform ${DURATION}ms ease, opacity ${DURATION}ms ease`;
            fromScenario.style.transition = transitionValue;
            toScenario.style.transition = transitionValue;

            // Animate outgoing scenario off-screen
            const exitX = direction === 'forward' ? '-100%' : '100%';
            fromScenario.style.transform = `translateX(${exitX})`;
            fromScenario.style.opacity = '0';

            // Animate incoming scenario to its normal position
            toScenario.style.transform = 'translateX(0)';
            toScenario.style.opacity = '1';

            setTimeout(() => {
                // Hide the outgoing scenario and reset all inline styles on both scenarios
                fromScenario.classList.add('hidden');
                for (const scenario of [fromScenario, toScenario]) {
                    scenario.style.removeProperty('position');
                    scenario.style.removeProperty('top');
                    scenario.style.removeProperty('left');
                    scenario.style.removeProperty('width');
                    scenario.style.removeProperty('transform');
                    scenario.style.removeProperty('opacity');
                    scenario.style.removeProperty('transition');
                }
                scenarioContainer.style.height = '';
                afterTransition();
            }, DURATION);
        }

        // Prev button handler - go to previous scenario
        prevBtn.addEventListener('click', () => {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            reset(); // reset scenario1 before it transitions into view
            switchScenario(scenario2, scenario1, 'backward', () => {
                resetScenario2(); // reset scenario2 after it has moved out of view
                nextBtn.disabled = false;
            });
        });

        // Next button handler - go to next scenario
        nextBtn.addEventListener('click', () => {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            resetScenario2(); // prepare scenario2 content while it's still hidden
            computeScenario2Policies(); // start computing in background
            switchScenario(scenario1, scenario2, 'forward', () => {
                reset(); // reset scenario1 after it has moved out of view
                prevBtn.disabled = false;
            });
        });

        // Update start button to handle both scenarios
        startBtn.addEventListener('click', async () => {
            if (!scenario1.classList.contains('hidden')) {
                // Scenario 1 logic (already handled above)
                return;
            }
            
            // Scenario 2 logic
            if (scenario2Policies.size === 0) {
                await computeScenario2Policies();
            }
            resetScenario2();
            await animateScenario2();
        });

        // Initial draw
        drawScenario1Grid();
