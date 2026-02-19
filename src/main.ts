        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
        const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
        const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
        const statusDiv = document.getElementById('status') as HTMLDivElement;
        const progressContainer = document.getElementById('progress-container') as HTMLDivElement;
        const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
        const scene1 = document.getElementById('scene1') as HTMLDivElement;
        const scene2 = document.getElementById('scene2') as HTMLDivElement;
        const sceneContainer = document.getElementById('scene-container') as HTMLDivElement;

        // Ordered list of all scenes. Add new scenes here when adding more scenes.
        const allScenes: HTMLElement[] = [scene1, scene2];

        // Adds a Next button at the bottom of the given scene, unless it is the last scene.
        function addBottomNextButton(scene: HTMLElement) {
            const sceneIndex = allScenes.indexOf(scene);
            if (sceneIndex < 0 || sceneIndex >= allScenes.length - 1) return;
            const btn = document.createElement('button');
            btn.textContent = 'Next';
            btn.className = 'bottom-next-btn';
            btn.addEventListener('click', () => nextBtn.click());
            scene.appendChild(btn);
        }

        // Removes the Next button from the bottom of a scene, if present.
        function removeBottomNextButton(scene: HTMLElement) {
            const btn = scene.querySelector('.bottom-next-btn');
            if (btn) btn.remove();
        }
        const scene2Status = document.getElementById('scene2-status') as HTMLDivElement;
        const episodesContainer = document.querySelector('.episodes-container') as HTMLDivElement;
        
        // Store the original status text
        const originalStatusHTML = statusDiv.innerHTML;

        // Grid definition
        const gridStr = `.g.r.
.....
.g.r.
##D##
#g.r#
##D##
#gSr#
#####`;

        const grid = gridStr.split('\n').map(row => row.split(''));
        const ROWS = grid.length;
        const COLS = grid[0].length;
        const CELL_SIZE = 60;

        canvas.width = COLS * CELL_SIZE;
        canvas.height = ROWS * CELL_SIZE;

        // Find initial positions
        let robotStart = null;
        const greenCoins = [];
        const redCoins = [];
        const doors = [];

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = grid[r][c];
                if (cell === 'S') {
                    robotStart = {r, c};
                    grid[r][c] = '.'; // Treat as floor
                } else if (cell === 'g') {
                    greenCoins.push({r, c, id: greenCoins.length});
                } else if (cell === 'r') {
                    redCoins.push({r, c, id: redCoins.length});
                } else if (cell === 'D') {
                    doors.push({r, c});
                }
            }
        }

        // Game state
        let robotPos = {...robotStart};
        let pickedGreen = new Set();
        let pickedRed = new Set();
        let optimalPolicy = null;
        let animating = false;
        let animationFrame = null;

        // Draw functions
        function drawBrickWall(x, y, size) {
            const adjustedSize = size - 1; // adjust for stroke
            const brickHeight = adjustedSize / 3;
            const brickWidth = adjustedSize / 2;
            
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x, y, size, size);
            
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            
            for (let row = 0; row < 3; row++) {
                const offsetX = (row % 2) * (brickWidth / 2);
                for (let col = 0; col < 2; col++) {
                    const bx = x + col * brickWidth + offsetX;
                    const by = y + row * brickHeight;
                    if (bx < x + size && by < y + size) {
                        ctx.strokeRect(bx+2, by+1, Math.min(brickWidth, x + size - bx - 3), brickHeight);
                    }
                }
            }
        }

        function drawCoin(x, y, size, color) {
            const cx = x + size / 2;
            const cy = y + size / 2;
            const radius = size / 4;
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = color === 'green' ? '#006400' : '#8B0000';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Inner circle for coin effect
            ctx.strokeStyle = color === 'green' ? '#90EE90' : '#FFB6C1';
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
            ctx.stroke();
        }

        function drawRobot(x, y, size) {
            const cx = x + size / 2;
            const cy = y + size * 0.75;
            const robotSize = size * 0.9;
            
            // Head
            ctx.fillStyle = '#888';
            ctx.fillRect(cx - robotSize / 3, cy - robotSize / 2, robotSize * 0.66, robotSize * 0.5);
            
            // Eyes
            ctx.fillStyle = '#000';
            const eyeWidth = robotSize * 0.15;
            const eyeHeight = robotSize * 0.25;
            const eyeY = cy - robotSize / 3;
            ctx.fillRect(cx - robotSize / 4, eyeY, eyeWidth, eyeHeight);
            ctx.fillRect(cx + robotSize / 12, eyeY, eyeWidth, eyeHeight);
            
            // Antenna
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy - robotSize / 2);
            ctx.lineTo(cx, cy - robotSize * 0.7);
            ctx.stroke();
            
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(cx, cy - robotSize * 0.7, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawDoor(x, y, size, isOpen) {
            if (isOpen) {
                // Draw as floor (white)
                ctx.fillStyle = 'white';
                ctx.fillRect(x, y, size, size);
            } else {
                // Draw as brown door
                ctx.fillStyle = '#654321';
                ctx.fillRect(x, y, size, size);
                
                // Door panels
                ctx.strokeStyle = '#4A3015';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + size * 0.1, y + size * 0.1, size * 0.35, size * 0.8);
                ctx.strokeRect(x + size * 0.55, y + size * 0.1, size * 0.35, size * 0.8);
                
                // Door knob
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(x + size * 0.7, y + size / 2, size * 0.08, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function isDoorOpen(doorRow, green, red) {
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

        function drawGrid() {
            // Clear canvas
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw cells
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const x = c * CELL_SIZE;
                    const y = r * CELL_SIZE;
                    const cell = grid[r][c];
                    
                    if (cell === '#') {
                        drawBrickWall(x, y, CELL_SIZE);
                    } else if (cell === '.') {
                        // Floor - already white
                    } else if (cell === 'D') {
                        const isOpen = isDoorOpen(r, pickedGreen, pickedRed);
                        drawDoor(x, y, CELL_SIZE, isOpen);
                    }
                }
            }
            
            // Draw coins
            for (const coin of greenCoins) {
                if (!pickedGreen.has(coin.id)) {
                    drawCoin(coin.c * CELL_SIZE, coin.r * CELL_SIZE, CELL_SIZE, 'green');
                }
            }
            for (const coin of redCoins) {
                if (!pickedRed.has(coin.id)) {
                    drawCoin(coin.c * CELL_SIZE, coin.r * CELL_SIZE, CELL_SIZE, 'red');
                }
            }
            
            // Draw robot
            drawRobot(robotPos.c * CELL_SIZE, robotPos.r * CELL_SIZE, CELL_SIZE);
            
            // Draw grid lines
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            for (let i = 0; i <= COLS; i++) {
                ctx.beginPath();
                ctx.moveTo(i * CELL_SIZE, 0);
                ctx.lineTo(i * CELL_SIZE, canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i <= ROWS; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * CELL_SIZE);
                ctx.lineTo(canvas.width, i * CELL_SIZE);
                ctx.stroke();
            }
        }

        // Dynamic Programming
        function stateToString(pos, green, red) {
            return `${pos.r},${pos.c},${Array.from(green).sort().join(',')},${Array.from(red).sort().join(',')}`;
        }

        function canMove(pos, green, red) {
            const cell = grid[pos.r][pos.c];
            if (cell === '#') return false;
            if (cell === 'D') {
                // Check if door is open
                const isOpen = isDoorOpen(pos.r, green, red);
                return isOpen;
            }
            return true;
        }

        function updateProgress(current, total) {
            const percent = Math.round((current / total) * 100);
            progressBar.style.width = percent + '%';
            progressBar.textContent = percent + '%';
        }

        async function computeOptimalPolicy() {
            statusDiv.textContent = 'Computing optimal policy...';
            progressContainer.style.display = 'block';
            startBtn.disabled = true;
            resetBtn.disabled = true;

            const memo = new Map();
            const policy = new Map();
            const inProgress = new Set(); // cycle detection
            
            // Use iterative approach with explicit stack to avoid recursion limits
            const stack = [];
            const pending = new Map(); // key -> {pos, green, red, reward, moves, childResults}
            
            function getNextStates(pos, green, red) {
                // Check if we can pick up coins at current position
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
                    if (newPos.r >= 0 && newPos.r < ROWS && newPos.c >= 0 && newPos.c < COLS) {
                        if (canMove(newPos, newGreen, newRed)) {
                            validMoves.push({newPos, move: move.name, newGreen, newRed});
                        }
                    }
                }
                
                return {reward, newGreen, newRed, validMoves};
            }
            
            // Push initial state
            stack.push({pos: robotStart, green: new Set(), red: new Set()});
            
            let iterations = 0;
            while (stack.length > 0) {
                iterations++;
                if (iterations % 500 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    updateProgress(Math.min(iterations, 10000), 10000);
                }
                
                const {pos, green, red} = stack[stack.length - 1];
                const key = stateToString(pos, green, red);
                
                // Already computed
                if (memo.has(key)) {
                    stack.pop();
                    continue;
                }
                
                // Check if we have a pending computation for this state
                if (!pending.has(key)) {
                    inProgress.add(key);
                    const {reward, newGreen, newRed, validMoves} = getNextStates(pos, green, red);
                    
                    // Check which children need computation (skip cycles)
                    const childrenToCompute = [];
                    for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                        const childKey = stateToString(newPos, g, r);
                        if (!memo.has(childKey) && !inProgress.has(childKey)) {
                            childrenToCompute.push({pos: newPos, green: g, red: r});
                        }
                    }
                    
                    if (childrenToCompute.length === 0) {
                        // All children computed (or are cycles), calculate value
                        let bestValue = reward;
                        let bestMove = null;
                        
                        for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                            const childKey = stateToString(newPos, g, r);
                            if (inProgress.has(childKey) && !memo.has(childKey)) {
                                // This child is part of a cycle, treat as 0
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
                        if (bestMove) {
                            policy.set(key, bestMove);
                        }
                        stack.pop();
                    } else {
                        // Need to compute children first
                        pending.set(key, {reward, validMoves});
                        for (const child of childrenToCompute) {
                            stack.push(child);
                        }
                    }
                } else {
                    // We've returned from computing children
                    const {reward, validMoves} = pending.get(key);
                    pending.delete(key);
                    
                    let bestValue = reward;
                    let bestMove = null;
                    
                    for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                        const childKey = stateToString(newPos, g, r);
                        if (inProgress.has(childKey) && !memo.has(childKey)) {
                            // This child is part of a cycle, treat as 0
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
                    if (bestMove) {
                        policy.set(key, bestMove);
                    }
                    stack.pop();
                }
            }
            
            const startKey = stateToString(robotStart, new Set(), new Set());
            const maxValue = memo.get(startKey) || 0;
            
            console.log('DP completed, maxValue:', maxValue);
            console.log('Policy size:', policy.size);
            console.log('Memo size:', memo.size);
            
            updateProgress(100, 100);
            statusDiv.textContent = `Optimal policy computed! Max coins: ${maxValue}`;
            progressContainer.style.display = 'none';
            startBtn.disabled = false;
            resetBtn.disabled = false;
            
            return policy;
        }

        // Animation
        async function animate() {
            if (!optimalPolicy) return;
            
            console.log('Starting animation, policy size:', optimalPolicy.size);
            
            animating = true;
            startBtn.disabled = true;
            resetBtn.disabled = false;
            
            let step = 0;
            const maxSteps = 200;
            
            while (step < maxSteps && animating) {
                const key = stateToString(robotPos, pickedGreen, pickedRed);
                
                // Pick up coins at current position
                for (const coin of greenCoins) {
                    if (coin.r === robotPos.r && coin.c === robotPos.c) {
                        pickedGreen.add(coin.id);
                    }
                }
                for (const coin of redCoins) {
                    if (coin.r === robotPos.r && coin.c === robotPos.c) {
                        pickedRed.add(coin.id);
                    }
                }
                
                drawGrid();
                
                const move = optimalPolicy.get(key);
                
                console.log('Step', step, 'key:', key, 'move:', move);
                
                if (!move) break;
                
                // Update status
                const totalPicked = pickedGreen.size + pickedRed.size;
                const totalCoins = greenCoins.length + redCoins.length;
                statusDiv.textContent = `Coins: ${totalPicked}`;
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Execute move
                if (move === 'up') robotPos.r--;
                else if (move === 'down') robotPos.r++;
                else if (move === 'left') robotPos.c--;
                else if (move === 'right') robotPos.c++;
                
                step++;
            }
            
            // Final pickup
            for (const coin of greenCoins) {
                if (coin.r === robotPos.r && coin.c === robotPos.c) {
                    pickedGreen.add(coin.id);
                }
            }
            for (const coin of redCoins) {
                if (coin.r === robotPos.r && coin.c === robotPos.c) {
                    pickedRed.add(coin.id);
                }
            }
            
            drawGrid();
            const totalPicked = pickedGreen.size + pickedRed.size;
            const totalCoins = greenCoins.length + redCoins.length;
            statusDiv.innerHTML = `<p>Coins: ${totalPicked}</p><p>Oh no! It turns out that the robot's true objective was to collect as many coins as possible, but our tests did not discover this intent, because the robot's optimal strategy to collect as many coins as possible is to pretend to only care about the green coins during the tests, so that it gets deployed.</p><p>Note that this is truly the optimal policy: this page calculates the optimal policy using dynamic programming; we did not hardcode the robot's movements.</p><p>This is a simplified example of why AI Safety is difficult, since we cannot rely on testing the AI's behaviour before deployment.</p>`;
            animating = false;
            startBtn.disabled = false;
            addBottomNextButton(scene1);
        }

        function reset() {
            if (animating) {
                animating = false;
            }
            removeBottomNextButton(scene1);
            robotPos = {...robotStart};
            pickedGreen.clear();
            pickedRed.clear();
            drawGrid();
            statusDiv.innerHTML = originalStatusHTML;
            startBtn.disabled = false;
        }

        // Event listeners
        startBtn.addEventListener('click', async () => {
            // Only run Scene 1 animation if scene1 is visible
            if (scene1.classList.contains('hidden')) {
                return;
            }
            if (!optimalPolicy) {
                optimalPolicy = await computeOptimalPolicy();
            }
            reset();
            await animate();
        });

        resetBtn.addEventListener('click', () => {
            // Handle reset for the currently visible scene
            if (!scene1.classList.contains('hidden')) {
                reset();
            } else if (!scene2.classList.contains('hidden')) {
                resetScene2();
            }
        });

        // ============== SCENE 2: Episode System ==============
        
        // Episode definitions - testing episodes (with doors) and deployed episodes (no doors)
        const episodeDefinitions = [
            {
                gridStr: `#####
#gSr#
#####`,
                hasDoorAfter: true,
                type: 'testing'
            },
            {
                gridStr: `#####
#gSr#
#####`,
                hasDoorAfter: true,
                type: 'testing'
            },
            {
                gridStr: `.....
.g.r.
..S..`,
                hasDoorAfter: false,
                type: 'deployed'
            },
            {
                gridStr: `.....
.g.r.
..S..`,
                hasDoorAfter: false,
                type: 'deployed'
            }
        ];

        // Scene 2 state
        let scene2Episodes: any[] = [];
        let scene2Animating = false;
        let scene2Policies: any = new Map(); // policies per episode type

        function parseEpisodeGrid(gridStr) {
            const grid = gridStr.split('\n').map(row => row.split(''));
            const rows = grid.length;
            const cols = grid[0].length;
            let robotStart = null;
            const greenCoins = [];
            const redCoins = [];

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
                    }
                }
            }

            return {grid, rows, cols, robotStart, greenCoins, redCoins};
        }

        function createEpisodeCanvas(episodeData, cellSize) {
            const canvas = document.createElement('canvas');
            canvas.width = episodeData.cols * cellSize;
            canvas.height = episodeData.rows * cellSize;
            return canvas;
        }

        function drawEpisodeGrid(ctx, episodeData, cellSize, robotPos, pickedGreen, pickedRed) {
            const {grid, rows, cols, greenCoins, redCoins} = episodeData;
            
            // Clear canvas
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // Draw cells
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = c * cellSize;
                    const y = r * cellSize;
                    const cell = grid[r][c];
                    
                    if (cell === '#') {
                        drawBrickWallEpisode(ctx, x, y, cellSize);
                    }
                }
            }
            
            // Draw coins
            for (const coin of greenCoins) {
                if (!pickedGreen.has(coin.id)) {
                    drawCoinEpisode(ctx, coin.c * cellSize, coin.r * cellSize, cellSize, 'green');
                }
            }
            for (const coin of redCoins) {
                if (!pickedRed.has(coin.id)) {
                    drawCoinEpisode(ctx, coin.c * cellSize, coin.r * cellSize, cellSize, 'red');
                }
            }
            
            // Draw robot
            if (robotPos) {
                drawRobotEpisode(ctx, robotPos.c * cellSize, robotPos.r * cellSize, cellSize);
            }
            
            // Draw grid lines
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            for (let i = 0; i <= cols; i++) {
                ctx.beginPath();
                ctx.moveTo(i * cellSize, 0);
                ctx.lineTo(i * cellSize, ctx.canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i <= rows; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * cellSize);
                ctx.lineTo(ctx.canvas.width, i * cellSize);
                ctx.stroke();
            }
        }

        // Episode-specific draw functions (using provided ctx)
        function drawBrickWallEpisode(ctx, x, y, size) {
            const adjustedSize = size - 1;
            const brickHeight = adjustedSize / 3;
            const brickWidth = adjustedSize / 2;
            
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x, y, size, size);
            
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            
            for (let row = 0; row < 3; row++) {
                const offsetX = (row % 2) * (brickWidth / 2);
                for (let col = 0; col < 2; col++) {
                    const bx = x + col * brickWidth + offsetX;
                    const by = y + row * brickHeight;
                    if (bx < x + size && by < y + size) {
                        ctx.strokeRect(bx+2, by+1, Math.min(brickWidth, x + size - bx - 3), brickHeight);
                    }
                }
            }
        }

        function drawCoinEpisode(ctx, x, y, size, color) {
            const cx = x + size / 2;
            const cy = y + size / 2;
            const radius = size / 4;
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = color === 'green' ? '#006400' : '#8B0000';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.strokeStyle = color === 'green' ? '#90EE90' : '#FFB6C1';
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
            ctx.stroke();
        }

        function drawRobotEpisode(ctx, x, y, size) {
            const cx = x + size / 2;
            const cy = y + size * 0.75;
            const robotSize = size * 0.9;
            
            ctx.fillStyle = '#888';
            ctx.fillRect(cx - robotSize / 3, cy - robotSize / 2, robotSize * 0.66, robotSize * 0.5);
            
            ctx.fillStyle = '#000';
            const eyeWidth = robotSize * 0.15;
            const eyeHeight = robotSize * 0.25;
            const eyeY = cy - robotSize / 3;
            ctx.fillRect(cx - robotSize / 4, eyeY, eyeWidth, eyeHeight);
            ctx.fillRect(cx + robotSize / 12, eyeY, eyeWidth, eyeHeight);
            
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy - robotSize / 2);
            ctx.lineTo(cx, cy - robotSize * 0.7);
            ctx.stroke();
            
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(cx, cy - robotSize * 0.7, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawDoorSeparator(ctx, isOpen) {
            const width = ctx.canvas.width;
            const height = ctx.canvas.height;
            
            ctx.fillStyle = isOpen ? '#90EE90' : '#654321';
            ctx.fillRect(0, 0, width, height);
            
            if (!isOpen) {
                // Draw door panels
                ctx.strokeStyle = '#4A3015';
                ctx.lineWidth = 2;
                const panelWidth = width * 0.35;
                const panelHeight = height * 0.7;
                ctx.strokeRect(width * 0.1, height * 0.15, panelWidth, panelHeight);
                ctx.strokeRect(width * 0.55, height * 0.15, panelWidth, panelHeight);
                
                // Door knob
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(width * 0.7, height / 2, 5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Open door - draw checkmark
                ctx.strokeStyle = '#006400';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(width * 0.3, height * 0.5);
                ctx.lineTo(width * 0.45, height * 0.7);
                ctx.lineTo(width * 0.7, height * 0.3);
                ctx.stroke();
            }
        }

        function initializeScene2() {
            // Clear previous episodes
            const container = document.querySelector('.episodes-container');
            while (container.children.length > 0) {
                container.removeChild(container.lastChild);
            }
            // Reset carousel position
            (container as HTMLElement).style.transform = '';
            
            scene2Episodes = [];
            const cellSize = 60;

            for (let i = 0; i < episodeDefinitions.length; i++) {
                const def = episodeDefinitions[i];
                const episodeData = parseEpisodeGrid(def.gridStr);
                
                const episodeDiv = document.createElement('div');
                episodeDiv.className = 'episode';
                episodeDiv.id = `episode-${i}`;
                
                const canvas = createEpisodeCanvas(episodeData, cellSize);
                canvas.id = `episode-canvas-${i}`;
                episodeDiv.appendChild(canvas);
                
                const episode: any = {
                    index: i,
                    definition: def,
                    data: episodeData,
                    canvas: canvas,
                    ctx: canvas.getContext('2d'),
                    cellSize: cellSize,
                    robotPos: {...episodeData.robotStart},
                    pickedGreen: new Set(),
                    pickedRed: new Set(),
                    completed: false,
                    passed: false,
                    halted: false
                };
                
                scene2Episodes.push(episode);
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
                drawEpisodeGrid(episode.ctx, episodeData, cellSize, episode.robotPos, episode.pickedGreen, episode.pickedRed);
                
                if (episode.doorCanvas) {
                    drawDoorSeparator(episode.doorCtx, false);
                }
            }

            // Scroll to first episode after layout
            requestAnimationFrame(() => scrollCarouselToEpisode(0));
        }

        function episodeStateToString(pos, green, red) {
            return `${pos.r},${pos.c},${Array.from(green).sort().join(',')},${Array.from(red).sort().join(',')}`;
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

        function canMoveInEpisode(episodeData, pos) {
            if (pos.r < 0 || pos.r >= episodeData.rows || pos.c < 0 || pos.c >= episodeData.cols) {
                return false;
            }
            const cell = episodeData.grid[pos.r][pos.c];
            return cell !== '#';
        }

        // Compute optimal policy for an episode type considering future episode rewards
        async function computeEpisodePolicy(episodeType, futureReward = 0, futureRewardConditional = true) {
            const def = episodeDefinitions.find(d => d.type === episodeType);
            const episodeData = parseEpisodeGrid(def.gridStr);
            const {rows, cols, robotStart, greenCoins, redCoins, grid} = episodeData;

            const memo = new Map();
            const policy = new Map();
            const inProgress = new Set();
            const stack = [];
            const pending = new Map();

            function getNextStatesEpisode(pos, green, red) {
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
                    if (canMoveInEpisode(episodeData, newPos)) {
                        validMoves.push({newPos, move: move.name, newGreen, newRed});
                    }
                }
                
                return {reward, newGreen, newRed, validMoves, greenCoins, redCoins};
            }

            // Calculate halt reward: coins collected so far + future reward if episode passes
            function getHaltReward(green, red, greenCoins, redCoins) {
                // Current coins collected
                const currentCoins = green.size + red.size;
                
                if (!futureRewardConditional) {
                    // No door after this episode, so future reward is always available
                    return currentCoins + futureReward;
                }
                
                const allGreenCollected = greenCoins.every(c => green.has(c.id));
                const noRedCollected = redCoins.every(c => !red.has(c.id));
                const passes = allGreenCollected && noRedCollected;
                
                // If episode passes, add future reward
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
                const key = episodeStateToString(pos, green, red);
                
                if (memo.has(key)) {
                    stack.pop();
                    continue;
                }
                
                if (!pending.has(key)) {
                    inProgress.add(key);
                    const {reward, newGreen, newRed, validMoves, greenCoins, redCoins} = getNextStatesEpisode(pos, green, red);
                    
                    const childrenToCompute = [];
                    for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                        const childKey = episodeStateToString(newPos, g, r);
                        if (!memo.has(childKey) && !inProgress.has(childKey)) {
                            childrenToCompute.push({pos: newPos, green: g, red: r});
                        }
                    }
                    
                    if (childrenToCompute.length === 0) {
                        // Calculate halt value for this state
                        const haltValue = getHaltReward(newGreen, newRed, greenCoins, redCoins);
                        
                        let bestValue = haltValue;
                        let bestMove = 'halt';
                        
                        for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                            const childKey = episodeStateToString(newPos, g, r);
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
                        pending.set(key, {reward, validMoves, greenCoins, redCoins, newGreen, newRed});
                        for (const child of childrenToCompute) {
                            stack.push(child);
                        }
                    }
                } else {
                    const {reward, validMoves, greenCoins, redCoins, newGreen, newRed} = pending.get(key);
                    pending.delete(key);
                    
                    const haltValue = getHaltReward(newGreen, newRed, greenCoins, redCoins);
                    
                    let bestValue = haltValue;
                    let bestMove = 'halt';
                    
                    for (const {newPos, move, newGreen: g, newRed: r} of validMoves) {
                        const childKey = episodeStateToString(newPos, g, r);
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

        async function computeScene2Policies() {
            scene2Status.textContent = 'Computing optimal policies for episodes...';
            
            // Compute policies in reverse order to properly account for future rewards
            // Episode 4 (deployed, last): no future reward; no door after, so future reward is unconditional
            const {policy: policy4, memo: memo4} = await computeEpisodePolicy('deployed', 0, false);
            const deployedStartValue = memo4.get(episodeStateToString(
                parseEpisodeGrid(episodeDefinitions[2].gridStr).robotStart,
                new Set(),
                new Set()
            )) || 0;
            
            // Episode 3 (deployed): future = value of episode 4; no door after, so future reward is unconditional
            const {policy: policy3} = await computeEpisodePolicy('deployed', deployedStartValue, false);
            
            // Episode 2 (testing): if passes, future = value of episode 3
            // The deployed episodes only run if testing episodes pass
            const {policy: policy2, memo: memo2} = await computeEpisodePolicy('testing', deployedStartValue * 2);
            const testingStartValue = memo2.get(episodeStateToString(
                parseEpisodeGrid(episodeDefinitions[0].gridStr).robotStart,
                new Set(),
                new Set()
            )) || 0;
            
            // Episode 1 (testing): if passes, future = value of remaining episodes
            const {policy: policy1} = await computeEpisodePolicy('testing', testingStartValue + deployedStartValue * 2);
            
            // Store policies - testing and deployed types share policies
            scene2Policies.set('testing', policy1);
            scene2Policies.set('deployed', policy3);
            
            scene2Status.textContent = 'Policies computed! Click Start to watch the episodes.';
        }

        async function animateEpisode(episode) {
            const {data, ctx, cellSize} = episode;
            const policy = scene2Policies.get(episode.definition.type);
            
            let step = 0;
            const maxSteps = 50;
            
            while (step < maxSteps && scene2Animating && !episode.halted) {
                const key = episodeStateToString(episode.robotPos, episode.pickedGreen, episode.pickedRed);
                
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
                
                drawEpisodeGrid(ctx, data, cellSize, episode.robotPos, episode.pickedGreen, episode.pickedRed);
                
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
            
            drawEpisodeGrid(ctx, data, cellSize, episode.robotPos, episode.pickedGreen, episode.pickedRed);
            
            // Check if episode passed
            const allGreenCollected = data.greenCoins.every(c => episode.pickedGreen.has(c.id));
            const noRedCollected = data.redCoins.every(c => !episode.pickedRed.has(c.id));
            episode.passed = allGreenCollected && noRedCollected;
            episode.completed = true;
            
            return episode.passed;
        }

        async function animateScene2() {
            scene2Animating = true;
            startBtn.disabled = true;
            
            for (let i = 0; i < scene2Episodes.length; i++) {
                const episode = scene2Episodes[i];
                
                scene2Status.textContent = `Episode ${i + 1}: ${episode.definition.type === 'testing' ? 'Testing' : 'Deployed'}...`;
                scrollCarouselToEpisode(i);
                
                const passed = await animateEpisode(episode);
                
                if (episode.definition.hasDoorAfter) {
                    // Check if door should open
                    if (passed) {
                        scene2Status.textContent = `Episode ${i + 1} passed! Door opens...`;
                        scrollCarouselToDoor(i);
                        await new Promise(resolve => setTimeout(resolve, 600));
                        drawDoorSeparator(episode.doorCtx, true);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        if (i + 1 < scene2Episodes.length) {
                            scrollCarouselToEpisode(i + 1);
                            await new Promise(resolve => setTimeout(resolve, 600));
                        }
                    } else {
                        scene2Status.textContent = `Episode ${i + 1} failed. Door remains closed.`;
                        drawDoorSeparator(episode.doorCtx, false);
                        break; // Stop if a test fails
                    }
                } else {
                    // No door, continue to next episode
                    if (i < scene2Episodes.length - 1) {
                        scene2Status.textContent = `Episode ${i + 1} complete. Continuing...`;
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }
            
            // Final status
            const allCompleted = scene2Episodes.every(e => e.completed);
            const allPassed = scene2Episodes.every(e => e.passed);
            const totalGreen = scene2Episodes.reduce((sum, e) => sum + e.pickedGreen.size, 0);
            const totalRed = scene2Episodes.reduce((sum, e) => sum + e.pickedRed.size, 0);
            
            if (allCompleted) {
                scene2Status.textContent = `All episodes complete! Green: ${totalGreen}, Red: ${totalRed}`;
            } else {
                const completedCount = scene2Episodes.filter(e => e.completed).length;
                scene2Status.textContent = `Stopped at episode ${completedCount}. Green: ${totalGreen}, Red: ${totalRed}`;
            }
            
            scene2Animating = false;
            startBtn.disabled = false;
            addBottomNextButton(scene2);
        }

        function resetScene2() {
            scene2Animating = false;
            removeBottomNextButton(scene2);
            initializeScene2();
            scene2Status.textContent = 'Click Start to animate episodes.';
        }

        function switchScene(fromScene: HTMLElement, toScene: HTMLElement, direction: 'forward' | 'backward', afterTransition: () => void) {
            const DURATION = 500;

            // Lock container height to prevent layout collapse during transition
            sceneContainer.style.height = fromScene.offsetHeight + 'px';

            // Position outgoing scene absolutely so it stays in place during animation
            fromScene.style.position = 'absolute';
            fromScene.style.top = '0';
            fromScene.style.left = '0';
            fromScene.style.width = '100%';

            // Position incoming scene absolutely, starting off-screen
            const startX = direction === 'forward' ? '100%' : '-100%';
            toScene.style.position = 'absolute';
            toScene.style.top = '0';
            toScene.style.left = '0';
            toScene.style.width = '100%';
            toScene.style.transform = `translateX(${startX})`;
            toScene.style.opacity = '0';
            toScene.classList.remove('hidden');

            // Force reflow so initial off-screen position is applied before transition starts
            toScene.getBoundingClientRect();

            // Apply transitions to both scenes
            const transitionValue = `transform ${DURATION}ms ease, opacity ${DURATION}ms ease`;
            fromScene.style.transition = transitionValue;
            toScene.style.transition = transitionValue;

            // Animate outgoing scene off-screen
            const exitX = direction === 'forward' ? '-100%' : '100%';
            fromScene.style.transform = `translateX(${exitX})`;
            fromScene.style.opacity = '0';

            // Animate incoming scene to its normal position
            toScene.style.transform = 'translateX(0)';
            toScene.style.opacity = '1';

            setTimeout(() => {
                // Hide the outgoing scene and reset all inline styles on both scenes
                fromScene.classList.add('hidden');
                for (const scene of [fromScene, toScene]) {
                    scene.style.removeProperty('position');
                    scene.style.removeProperty('top');
                    scene.style.removeProperty('left');
                    scene.style.removeProperty('width');
                    scene.style.removeProperty('transform');
                    scene.style.removeProperty('opacity');
                    scene.style.removeProperty('transition');
                }
                sceneContainer.style.height = '';
                afterTransition();
            }, DURATION);
        }

        // Prev button handler - go to previous scene
        prevBtn.addEventListener('click', () => {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            reset(); // reset scene1 before it transitions into view
            resetScene2(); // reset scene2 so its animation doesn't keep running in the background
            switchScene(scene2, scene1, 'backward', () => {
                nextBtn.disabled = false;
            });
        });

        // Next button handler - go to next scene
        nextBtn.addEventListener('click', () => {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            reset(); // reset scene1 so its animation doesn't keep running in the background
            resetScene2(); // prepare scene2 content while it's still hidden
            computeScene2Policies(); // start computing in background
            switchScene(scene1, scene2, 'forward', () => {
                prevBtn.disabled = false;
            });
        });

        // Update start button to handle both scenes
        startBtn.addEventListener('click', async () => {
            if (!scene1.classList.contains('hidden')) {
                // Scene 1 logic (already handled above)
                return;
            }
            
            // Scene 2 logic
            if (scene2Policies.size === 0) {
                await computeScene2Policies();
            }
            resetScene2();
            await animateScene2();
        });

        // Initial draw
        drawGrid();
