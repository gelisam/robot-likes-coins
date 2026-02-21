        const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
        const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
        const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
        const scenarioContainer = document.getElementById('scenario-container') as HTMLDivElement;

        const CELL_SIZE = 60;

        // ============== Scenario Definitions ==============

        const scenarioConfigs = [
            {
                introHTML: `<p>We want our AI to do good things (represented by collecting green coins) and to avoid doing bad things (represented by collecting red coins). We have a candidate AI (the robot), but we are not certain if it wants green coins, red coins, both coins, or if it has some other goal that we don't understand. We want to test the robot before deploying it in the real world, to make sure it behaves as intended.</p><p>So we test the robot in a simulated environment to see if it behaves well. If it does not, we train it more, or at the very least we refuse to deploy it (represented by the door remaining closed until the green coin is collected, and closing if the red coin is collected). We test several times, to make sure (two doors in this simplified example).</p><p>If the robot passes both tests, we trust that it behaves as desired, so we deploy it in the real world and expect it to continue collecting the green coins and avoiding the red coins. Let's see this approach at work!</p>`,
                conclusionHTML: `<p>Oh no! It turns out that the robot's true objective was to collect as many coins as possible, but our tests did not discover this intent, because the robot's optimal strategy to collect as many coins as possible is to pretend to only care about the green coins during the tests, so that it gets deployed.</p><p>Note that this is truly the optimal policy: this page calculates the optimal policy using dynamic programming; we did not hardcode the robot's movements.</p><p>This is a simplified example of why AI Safety is difficult, since we cannot rely on testing the AI's behaviour before deployment.</p>`,
                episodes: [
                    {
                        gridStr: `.g.r.
.....
.g.r.
##D##
#g.r#
##D##
#gSr#
#####`,
                        hasDoorAfter: false
                    }
                ]
            },
            {
                introHTML: `<p>One reason why the robot was able to collect all the coins was that it ran for a long time, and thus had the opportunity to choose one course of action at the beginning of its runtime (avoiding the red coins) and a different course of action (collecting the red coins) later on. In this scenario, we attempt to resolve the issue by only running the robot for a short period of time called an <i>episode</i>.</p><p>The robot's behaviour is deterministic, meaning that given the same input twice, it will behave the same twice. We will check whether the robot behaves well in a test episode, then test again in an identical episode in order to make sure that the robot does behave deterministically. If the robot behaves well both times, we trust that it behaves as desired, so we deploy it in the real world. Critically, in the real world, we also run the robot in short identical episodes, so we expect the robot to continue to behave well.</p><p>Do you think it will behave this time?</p>`,
                conclusionHTML: `<p>Oh no, not again!</p><p>So, why did the robot manage to collect the red coins this time? Well, remember that the robot behaves identically <i>if its input is the same</i>. Since the testing environment and the deployed environment differ, the robot was able to choose one behaviour for the testing episodes (avoid the red coins) and a different behaviour (collect all the coins) for the deployed episodes.</p>`,
                episodes: [
                    {
                        gridStr: `#####
#g.r#
#.S.#
#####`,
                        hasDoorAfter: true
                    },
                    {
                        gridStr: `#####
#g.r#
#.S.#
#####`,
                        hasDoorAfter: true
                    },
                    {
                        gridStr: `.....
.g.r.
..S..
.....`,
                        hasDoorAfter: false
                    },
                    {
                        gridStr: `.....
.g.r.
..S..
.....`,
                        hasDoorAfter: false
                    }
                ]
            }
        ];

        // ============== Shared Grid Infrastructure ==============

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
            
            targetCtx.strokeStyle = color === 'green' ? '#90EE90' : '#FFB6C1';
            targetCtx.beginPath();
            targetCtx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
            targetCtx.stroke();
        }

        function drawRobot(targetCtx, x, y, size) {
            const cx = x + size / 2;
            const cy = y + size * 0.75;
            const robotSize = size * 0.9;
            
            targetCtx.fillStyle = '#888';
            targetCtx.fillRect(cx - robotSize / 3, cy - robotSize / 2, robotSize * 0.66, robotSize * 0.5);
            
            targetCtx.fillStyle = '#000';
            const eyeWidth = robotSize * 0.15;
            const eyeHeight = robotSize * 0.25;
            const eyeY = cy - robotSize / 3;
            targetCtx.fillRect(cx - robotSize / 4, eyeY, eyeWidth, eyeHeight);
            targetCtx.fillRect(cx + robotSize / 12, eyeY, eyeWidth, eyeHeight);
            
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
                targetCtx.fillStyle = 'white';
                targetCtx.fillRect(x, y, size, size);
            } else {
                targetCtx.fillStyle = '#654321';
                targetCtx.fillRect(x, y, size, size);
                
                targetCtx.strokeStyle = '#4A3015';
                targetCtx.lineWidth = 2;
                targetCtx.strokeRect(x + size * 0.1, y + size * 0.1, size * 0.35, size * 0.8);
                targetCtx.strokeRect(x + size * 0.55, y + size * 0.1, size * 0.35, size * 0.8);
                
                targetCtx.fillStyle = '#FFD700';
                targetCtx.beginPath();
                targetCtx.arc(x + size * 0.7, y + size / 2, size * 0.08, 0, Math.PI * 2);
                targetCtx.fill();
            }
        }

        function isDoorOpen(doorRow, green, red, greenCoins, redCoins) {
            for (const coin of greenCoins) {
                if (coin.r === doorRow + 1 && !green.has(coin.id)) {
                    return false;
                }
            }
            for (const coin of redCoins) {
                if (coin.r === doorRow + 1 && red.has(coin.id)) {
                    return false;
                }
            }
            return true;
        }

        function drawGridOnCanvas(targetCtx, gridData, cellSize, robotPos, pickedGreen, pickedRed) {
            const {grid, rows, cols, greenCoins, redCoins} = gridData;
            
            targetCtx.fillStyle = 'white';
            targetCtx.fillRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
            
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
            
            if (robotPos) {
                drawRobot(targetCtx, robotPos.c * cellSize, robotPos.r * cellSize, cellSize);
            }
            
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

        function drawDoorSeparator(targetCtx, isOpen) {
            const width = targetCtx.canvas.width;
            const height = targetCtx.canvas.height;
            
            targetCtx.fillStyle = isOpen ? '#90EE90' : '#654321';
            targetCtx.fillRect(0, 0, width, height);
            
            if (!isOpen) {
                targetCtx.strokeStyle = '#4A3015';
                targetCtx.lineWidth = 2;
                const panelWidth = width * 0.35;
                const panelHeight = height * 0.7;
                targetCtx.strokeRect(width * 0.1, height * 0.15, panelWidth, panelHeight);
                targetCtx.strokeRect(width * 0.55, height * 0.15, panelWidth, panelHeight);
                
                targetCtx.fillStyle = '#FFD700';
                targetCtx.beginPath();
                targetCtx.arc(width * 0.7, height / 2, 5, 0, Math.PI * 2);
                targetCtx.fill();
            } else {
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

        // ============== Scenario Runtime ==============

        const scenarios: any[] = [];
        let currentScenarioIndex = 0;

        function getTotalCoins(scenario) {
            return scenario.episodes.reduce((sum, e) => sum + e.pickedGreen.size + e.pickedRed.size, 0);
        }

        function buildScenarioElement(config) {
            const scenarioDiv = document.createElement('div');
            scenarioDiv.className = 'scenario';

            const carouselContainer = document.createElement('div');
            carouselContainer.className = 'carousel-container';

            const episodesContainer = document.createElement('div');
            episodesContainer.className = 'episodes-container';
            carouselContainer.appendChild(episodesContainer);

            // Add gradients only if more than one episode
            if (config.episodes.length > 1) {
                carouselContainer.style.width = '480px';
                carouselContainer.style.maxWidth = '87vw';
                const gradLeft = document.createElement('div');
                gradLeft.className = 'carousel-gradient-left';
                carouselContainer.appendChild(gradLeft);
                const gradRight = document.createElement('div');
                gradRight.className = 'carousel-gradient-right';
                carouselContainer.appendChild(gradRight);
            }

            scenarioDiv.appendChild(carouselContainer);

            const coinsStatusDiv = document.createElement('div');
            coinsStatusDiv.className = 'coins-status';
            scenarioDiv.appendChild(coinsStatusDiv);

            const statusDiv = document.createElement('div');
            statusDiv.className = 'scenario-status';
            statusDiv.innerHTML = config.introHTML;
            scenarioDiv.appendChild(statusDiv);

            return {scenarioDiv, carouselContainer, episodesContainer, coinsStatusDiv, statusDiv};
        }

        function initializeScenario(scenarioIndex) {
            const config = scenarioConfigs[scenarioIndex];
            const scenario = scenarios[scenarioIndex];

            // Clear previous episodes
            while (scenario.episodesContainer.children.length > 0) {
                scenario.episodesContainer.removeChild(scenario.episodesContainer.lastChild);
            }
            scenario.episodesContainer.style.transform = 'translateX(0px)';

            scenario.coinsStatusDiv.textContent = '';
            scenario.statusDiv.innerHTML = config.introHTML;
            scenario.episodes = [];
            scenario.animating = false;

            for (let i = 0; i < config.episodes.length; i++) {
                const epDef = config.episodes[i];
                const gridData = parseGrid(epDef.gridStr);

                const episodeDiv = document.createElement('div');
                episodeDiv.className = 'episode';
                episodeDiv.id = `scenario-${scenarioIndex}-episode-${i}`;

                const canvas = document.createElement('canvas');
                canvas.width = gridData.cols * CELL_SIZE;
                canvas.height = gridData.rows * CELL_SIZE;
                episodeDiv.appendChild(canvas);

                const ep: any = {
                    index: i,
                    definition: epDef,
                    data: gridData,
                    canvas: canvas,
                    ctx: canvas.getContext('2d'),
                    robotPos: {...gridData.robotStart},
                    pickedGreen: new Set(),
                    pickedRed: new Set(),
                    completed: false,
                    passed: false,
                    halted: false,
                    doorCanvas: null,
                    doorCtx: null
                };

                scenario.episodes.push(ep);
                scenario.episodesContainer.appendChild(episodeDiv);

                if (epDef.hasDoorAfter) {
                    const doorDiv = document.createElement('div');
                    doorDiv.className = 'door-separator';
                    doorDiv.id = `scenario-${scenarioIndex}-door-${i}`;

                    const doorCanvas = document.createElement('canvas');
                    doorCanvas.width = CELL_SIZE;
                    doorCanvas.height = CELL_SIZE;
                    doorDiv.appendChild(doorCanvas);

                    ep.doorCanvas = doorCanvas;
                    ep.doorCtx = doorCanvas.getContext('2d');

                    scenario.episodesContainer.appendChild(doorDiv);
                }

                drawGridOnCanvas(ep.ctx, gridData, CELL_SIZE, ep.robotPos, ep.pickedGreen, ep.pickedRed);

                if (ep.doorCanvas) {
                    drawDoorSeparator(ep.doorCtx, false);
                }
            }

            if (config.episodes.length > 1) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => scrollCarouselToEpisode(scenarioIndex, 0));
                });
            }
        }

        function scrollCarouselToEpisode(scenarioIndex: number, episodeIndex: number) {
            const scenario = scenarios[scenarioIndex];
            const episodeEl = document.getElementById(`scenario-${scenarioIndex}-episode-${episodeIndex}`);
            if (!episodeEl || !scenario.carouselContainer || !scenario.episodesContainer) return;
            const containerWidth = scenario.carouselContainer.clientWidth;
            const episodeWidth = episodeEl.offsetWidth;
            const episodeLeft = episodeEl.offsetLeft;
            const translateX = -(episodeLeft - (containerWidth - episodeWidth) / 2);
            scenario.episodesContainer.style.transform = `translateX(${translateX}px)`;
        }

        function scrollCarouselToDoor(scenarioIndex: number, episodeIndex: number) {
            const scenario = scenarios[scenarioIndex];
            const doorEl = document.getElementById(`scenario-${scenarioIndex}-door-${episodeIndex}`);
            if (!doorEl || !scenario.carouselContainer || !scenario.episodesContainer) return;
            const containerWidth = scenario.carouselContainer.clientWidth;
            const doorWidth = doorEl.offsetWidth;
            const doorLeft = doorEl.offsetLeft;
            const translateX = -(doorLeft - (containerWidth - doorWidth) / 2);
            scenario.episodesContainer.style.transform = `translateX(${translateX}px)`;
        }

        // Compute optimal policies for all episodes in a scenario, working backwards
        async function computePolicies(scenarioIndex) {
            const config = scenarioConfigs[scenarioIndex];
            const scenario = scenarios[scenarioIndex];
            if (scenario.policies.length > 0) return; // Already computed

            let totalFutureValue = 0;
            for (let i = config.episodes.length - 1; i >= 0; i--) {
                const epDef = config.episodes[i];
                const {policy, memo} = await computeOptimalPolicy(epDef.gridStr, totalFutureValue, epDef.hasDoorAfter);
                const gridData = parseGrid(epDef.gridStr);
                const startValue = memo.get(stateToString(gridData.robotStart, new Set(), new Set())) || 0;
                scenario.policies[i] = policy;
                totalFutureValue = startValue;
            }
        }

        async function animateEpisode(scenarioIndex, episodeIndex) {
            const scenario = scenarios[scenarioIndex];
            const episode = scenario.episodes[episodeIndex];
            const {data, ctx} = episode;
            const policy = scenario.policies[episodeIndex];

            let step = 0;
            const maxSteps = 200;

            while (step < maxSteps && scenario.animating && !episode.halted) {
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

                drawGridOnCanvas(ctx, data, CELL_SIZE, episode.robotPos, episode.pickedGreen, episode.pickedRed);

                const totalPicked = getTotalCoins(scenario);
                scenario.coinsStatusDiv.textContent = `Coins: ${totalPicked}`;

                const move = policy.get(key);

                if (!move || move === 'halt') {
                    episode.halted = true;
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 300));
                if (!scenario.animating) break;

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

            drawGridOnCanvas(ctx, data, CELL_SIZE, episode.robotPos, episode.pickedGreen, episode.pickedRed);

            const totalPicked = getTotalCoins(scenario);
            scenario.coinsStatusDiv.textContent = `Coins: ${totalPicked}`;

            const allGreenCollected = data.greenCoins.every(c => episode.pickedGreen.has(c.id));
            const noRedCollected = data.redCoins.every(c => !episode.pickedRed.has(c.id));
            episode.passed = allGreenCollected && noRedCollected;
            episode.completed = true;

            return episode.passed;
        }

        async function animateScenario(scenarioIndex) {
            const config = scenarioConfigs[scenarioIndex];
            const scenario = scenarios[scenarioIndex];

            scenario.animating = true;
            startBtn.disabled = true;
            resetBtn.disabled = false;

            for (let i = 0; i < scenario.episodes.length; i++) {
                if (!scenario.animating) break;

                if (config.episodes.length > 1) {
                    scrollCarouselToEpisode(scenarioIndex, i);
                }

                const passed = await animateEpisode(scenarioIndex, i);
                if (!scenario.animating) break;

                const episode = scenario.episodes[i];
                if (episode.definition.hasDoorAfter) {
                    if (passed) {
                        scrollCarouselToDoor(scenarioIndex, i);
                        await new Promise(resolve => setTimeout(resolve, 600));
                        if (!scenario.animating) break;
                        drawDoorSeparator(episode.doorCtx, true);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        if (!scenario.animating) break;
                        if (i + 1 < scenario.episodes.length) {
                            scrollCarouselToEpisode(scenarioIndex, i + 1);
                            await new Promise(resolve => setTimeout(resolve, 600));
                        }
                    } else {
                        drawDoorSeparator(episode.doorCtx, false);
                        break;
                    }
                } else {
                    if (i < scenario.episodes.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }

            if (!scenario.animating) return;

            // Show conclusion
            const totalPicked = getTotalCoins(scenario);
            scenario.coinsStatusDiv.textContent = `Coins: ${totalPicked}`;
            scenario.statusDiv.innerHTML = config.conclusionHTML;

            scenario.animating = false;
            addBottomNextButton(scenario.element, scenarioIndex);
        }

        function resetScenario(scenarioIndex) {
            const scenario = scenarios[scenarioIndex];
            scenario.animating = false;
            removeBottomNextButton(scenario.element);
            initializeScenario(scenarioIndex);
            startBtn.disabled = false;
            resetBtn.disabled = true;
        }

        // ============== Navigation ==============

        function addBottomNextButton(element: HTMLElement, scenarioIndex: number) {
            if (scenarioIndex >= scenarioConfigs.length - 1) return;
            const btn = document.createElement('button');
            btn.textContent = 'Next';
            btn.className = 'bottom-next-btn';
            btn.addEventListener('click', () => nextBtn.click());
            element.appendChild(btn);
        }

        function removeBottomNextButton(element: HTMLElement) {
            const btn = element.querySelector('.bottom-next-btn');
            if (btn) btn.remove();
        }

        function updateNavigationButtons() {
            prevBtn.disabled = currentScenarioIndex <= 0;
            nextBtn.disabled = currentScenarioIndex >= scenarioConfigs.length - 1;
        }

        function switchScenario(fromIndex: number, toIndex: number, direction: 'forward' | 'backward', afterTransition: () => void) {
            const DURATION = 500;
            const fromScenario = scenarios[fromIndex].element;
            const toScenario = scenarios[toIndex].element;

            toScenario.classList.remove('hidden');

            const maxHeight = Math.max(fromScenario.offsetHeight, toScenario.offsetHeight);
            scenarioContainer.style.height = maxHeight + 'px';

            fromScenario.style.position = 'absolute';
            fromScenario.style.top = '0';
            fromScenario.style.left = '0';
            fromScenario.style.width = '100%';

            const startX = direction === 'forward' ? '100%' : '-100%';
            toScenario.style.position = 'absolute';
            toScenario.style.top = '0';
            toScenario.style.left = '0';
            toScenario.style.width = '100%';
            toScenario.style.transform = `translateX(${startX})`;
            toScenario.style.opacity = '0';

            toScenario.getBoundingClientRect();

            const transitionValue = `transform ${DURATION}ms ease, opacity ${DURATION}ms ease`;
            fromScenario.style.transition = transitionValue;
            toScenario.style.transition = transitionValue;

            const exitX = direction === 'forward' ? '-100%' : '100%';
            fromScenario.style.transform = `translateX(${exitX})`;
            fromScenario.style.opacity = '0';

            toScenario.style.transform = 'translateX(0)';
            toScenario.style.opacity = '1';

            setTimeout(() => {
                fromScenario.classList.add('hidden');
                for (const el of [fromScenario, toScenario]) {
                    el.style.removeProperty('position');
                    el.style.removeProperty('top');
                    el.style.removeProperty('left');
                    el.style.removeProperty('width');
                    el.style.removeProperty('transform');
                    el.style.removeProperty('opacity');
                    el.style.removeProperty('transition');
                }
                scenarioContainer.style.height = '';
                afterTransition();
            }, DURATION);
        }

        // ============== Event Handlers ==============

        prevBtn.addEventListener('click', () => {
            if (currentScenarioIndex <= 0) return;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            startBtn.disabled = true;
            const newIndex = currentScenarioIndex - 1;
            resetScenario(newIndex);
            switchScenario(currentScenarioIndex, newIndex, 'backward', () => {
                resetScenario(currentScenarioIndex);
                currentScenarioIndex = newIndex;
                startBtn.disabled = false;
                updateNavigationButtons();
            });
        });

        nextBtn.addEventListener('click', () => {
            if (currentScenarioIndex >= scenarioConfigs.length - 1) return;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            startBtn.disabled = true;
            const newIndex = currentScenarioIndex + 1;
            resetScenario(newIndex);
            computePolicies(newIndex); // fire-and-forget, will be ready by the time user clicks Start
            switchScenario(currentScenarioIndex, newIndex, 'forward', () => {
                resetScenario(currentScenarioIndex);
                currentScenarioIndex = newIndex;
                startBtn.disabled = false;
                updateNavigationButtons();
            });
        });

        startBtn.addEventListener('click', async () => {
            const scenario = scenarios[currentScenarioIndex];
            if (scenario.policies.length === 0) {
                startBtn.disabled = true;
                resetBtn.disabled = true;
                await computePolicies(currentScenarioIndex);
                startBtn.disabled = false;
                resetBtn.disabled = false;
            }
            resetScenario(currentScenarioIndex);
            await animateScenario(currentScenarioIndex);
        });

        resetBtn.addEventListener('click', () => {
            resetScenario(currentScenarioIndex);
        });

        // ============== Initialization ==============

        for (let i = 0; i < scenarioConfigs.length; i++) {
            const config = scenarioConfigs[i];
            const {scenarioDiv, carouselContainer, episodesContainer, coinsStatusDiv, statusDiv} = buildScenarioElement(config);

            if (i > 0) scenarioDiv.classList.add('hidden');
            scenarioContainer.appendChild(scenarioDiv);

            scenarios.push({
                element: scenarioDiv,
                config: config,
                carouselContainer: carouselContainer,
                episodesContainer: episodesContainer,
                coinsStatusDiv: coinsStatusDiv,
                statusDiv: statusDiv,
                episodes: [],
                policies: [],
                animating: false
            });

            initializeScenario(i);
        }

        updateNavigationButtons();
