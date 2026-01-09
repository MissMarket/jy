/**
 * HMM（隐马尔可夫模型）核心算法实现
 * 包含：前向算法、后向算法、Baum-Welch算法（EM）、维特比算法
 */

// ==================== 可复现的随机数生成器 ====================
let currentSeed = 12345

/**
 * 设置随机种子
 * @param {number} seed - 随机种子
 */
export const setRandomSeed = (seed) => {
  currentSeed = seed
}

/**
 * 获取伪随机数（基于种子的可复现随机数）
 * 使用简单的线性同余生成器（LCG）
 * @returns {number} 0到1之间的随机数
 */
export const seededRandom = () => {
  currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296
  return currentSeed / 4294967296
}

/**
 * HMM模型类
 */
export class HMM {
  constructor(numStates, numObservations) {
    this.numStates = numStates        // 隐藏状态数量
    this.numObservations = numObservations  // 观测状态数量
    
    // 初始化概率分布 π
    this.initialProb = new Array(numStates).fill(1 / numStates)
    
    // 状态转移矩阵 A (numStates x numStates)
    this.transitionProb = []
    for (let i = 0; i < numStates; i++) {
      const row = new Array(numStates).fill(1 / numStates)
      this.transitionProb.push(row)
    }
    
    // 观测概率矩阵 B (numStates x numObservations)
    this.emissionProb = []
    for (let i = 0; i < numStates; i++) {
      const row = new Array(numObservations).fill(1 / numObservations)
      this.emissionProb.push(row)
    }
  }
  
  /**
   * 初始化模型参数（随机初始化）
   * @param {boolean} useSeededRandom - 是否使用种子随机数（默认true）
   */
  randomInitialize(useSeededRandom = true) {
    const randomFn = useSeededRandom ? seededRandom : Math.random

    // 初始化状态概率
    let sum = 0
    this.initialProb = this.initialProb.map(() => randomFn())
    sum = this.initialProb.reduce((a, b) => a + b, 0)
    this.initialProb = this.initialProb.map(p => p / sum)

    // 初始化转移概率
    for (let i = 0; i < this.numStates; i++) {
      sum = 0
      this.transitionProb[i] = this.transitionProb[i].map(() => randomFn())
      sum = this.transitionProb[i].reduce((a, b) => a + b, 0)
      this.transitionProb[i] = this.transitionProb[i].map(p => p / sum)
    }

    // 初始化观测概率
    for (let i = 0; i < this.numStates; i++) {
      sum = 0
      this.emissionProb[i] = this.emissionProb[i].map(() => randomFn())
      sum = this.emissionProb[i].reduce((a, b) => a + b, 0)
      this.emissionProb[i] = this.emissionProb[i].map(p => p / sum)
    }
  }
  
  /**
   * 前向算法：计算前向概率
   * @param {number[]} observations - 观测序列
   * @returns {number[][]} alpha[t][i] = P(O1..Ot, qt=Si | lambda)
   */
  forward(observations) {
    const T = observations.length
    const alpha = []
    
    // 初始化：t = 1
    const alpha1 = []
    for (let i = 0; i < this.numStates; i++) {
      alpha1.push(this.initialProb[i] * this.emissionProb[i][observations[0]])
    }
    alpha.push(alpha1)
    
    // 递归：t = 2..T
    for (let t = 1; t < T; t++) {
      const alphaT = []
      for (let j = 0; j < this.numStates; j++) {
        let sum = 0
        for (let i = 0; i < this.numStates; i++) {
          sum += alpha[t - 1][i] * this.transitionProb[i][j]
        }
        alphaT.push(sum * this.emissionProb[j][observations[t]])
      }
      alpha.push(alphaT)
    }
    
    return alpha
  }
  
  /**
   * 后向算法：计算后向概率
   * @param {number[]} observations - 观测序列
   * @returns {number[][]} beta[t][i] = P(Ot+1..OT | qt=Si, lambda)
   */
  backward(observations) {
    const T = observations.length
    const beta = []
    
    // 初始化：t = T
    const betaT = new Array(this.numStates).fill(1)
    beta.unshift(betaT)
    
    // 递归：t = T-1..1
    for (let t = T - 1; t >= 0; t--) {
      const betaT = []
      for (let i = 0; i < this.numStates; i++) {
        let sum = 0
        for (let j = 0; j < this.numStates; j++) {
          sum += this.transitionProb[i][j] * this.emissionProb[j][observations[t]] * beta[0][j]
        }
        betaT.push(sum)
      }
      beta.unshift(betaT)
    }
    
    return beta
  }
  
  /**
   * Baum-Welch算法：EM算法训练HMM
   * @param {number[]} observations - 观测序列
   * @param {number} maxIterations - 最大迭代次数
   * @param {number} tolerance - 收敛容忍度
   * @returns {number} 对数似然
   */
  train(observations, maxIterations = 100, tolerance = 1e-6) {
    let prevLogLikelihood = -Infinity
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // E-step：计算前向和后向概率
      const alpha = this.forward(observations)
      const beta = this.backward(observations)
      
      // 计算观测序列概率
      const T = observations.length
      let pObs = 0
      for (let i = 0; i < this.numStates; i++) {
        pObs += alpha[T - 1][i]
      }
      
      if (pObs === 0) continue
      
      // 计算gamma和xi
      const gamma = []
      const xi = []
      
      // 计算gamma[t][i] = P(qt=Si | O, lambda)
      for (let t = 0; t < T; t++) {
        const gammaT = []
        for (let i = 0; i < this.numStates; i++) {
          gammaT.push((alpha[t][i] * beta[t][i]) / pObs)
        }
        gamma.push(gammaT)
      }
      
      // 计算xi[t][i][j] = P(qt=Si, qt+1=Sj | O, lambda)
      for (let t = 0; t < T - 1; t++) {
        const xiT = []
        let sumXi = 0
        for (let i = 0; i < this.numStates; i++) {
          const xiTi = []
          for (let j = 0; j < this.numStates; j++) {
            const value = (alpha[t][i] * this.transitionProb[i][j] * 
                          this.emissionProb[j][observations[t + 1]] * beta[t + 1][j]) / pObs
            xiTi.push(value)
            sumXi += value
          }
          xiT.push(xiTi)
        }
        xi.push(xiT)
      }
      
      // M-step：更新参数
      
      // 更新初始概率
      for (let i = 0; i < this.numStates; i++) {
        this.initialProb[i] = gamma[0][i]
      }
      
      // 更新转移概率
      for (let i = 0; i < this.numStates; i++) {
        let sumGamma = 0
        for (let t = 0; t < T - 1; t++) {
          sumGamma += gamma[t][i]
        }
        
        for (let j = 0; j < this.numStates; j++) {
          let sumXi = 0
          for (let t = 0; t < T - 1; t++) {
            sumXi += xi[t][i][j]
          }
          this.transitionProb[i][j] = sumGamma > 0 ? sumXi / sumGamma : 0
        }
      }
      
      // 更新观测概率
      for (let i = 0; i < this.numStates; i++) {
        let sumGamma = 0
        const sumGammaObs = new Array(this.numObservations).fill(0)
        
        for (let t = 0; t < T; t++) {
          sumGamma += gamma[t][i]
          sumGammaObs[observations[t]] += gamma[t][i]
        }
        
        for (let j = 0; j < this.numObservations; j++) {
          this.emissionProb[i][j] = sumGamma > 0 ? sumGammaObs[j] / sumGamma : 0
        }
      }
      
      // 计算对数似然
      const logLikelihood = Math.log(pObs + 1e-10)
      
      // 检查收敛
      if (Math.abs(logLikelihood - prevLogLikelihood) < tolerance) {
        console.log(`HMM训练收敛，迭代次数: ${iter + 1}`)
        break
      }
      
      prevLogLikelihood = logLikelihood
    }
    
    return prevLogLikelihood
  }
  
  /**
   * 维特比算法：解码最可能的状态序列
   * @param {number[]} observations - 观测序列
   * @returns {number[]} 最优状态序列
   */
  viterbi(observations) {
    const T = observations.length
    const delta = []
    const psi = []
    
    // 初始化
    const delta1 = []
    const psi1 = []
    for (let i = 0; i < this.numStates; i++) {
      delta1.push(Math.log(this.initialProb[i] + 1e-10) + Math.log(this.emissionProb[i][observations[0]] + 1e-10))
      psi1.push(0)
    }
    delta.push(delta1)
    psi.push(psi1)
    
    // 递归
    for (let t = 1; t < T; t++) {
      const deltaT = []
      const psiT = []
      for (let j = 0; j < this.numStates; j++) {
        let maxVal = -Infinity
        let maxIdx = 0
        for (let i = 0; i < this.numStates; i++) {
          const val = delta[t - 1][i] + Math.log(this.transitionProb[i][j] + 1e-10)
          if (val > maxVal) {
            maxVal = val
            maxIdx = i
          }
        }
        deltaT.push(maxVal + Math.log(this.emissionProb[j][observations[t]] + 1e-10))
        psiT.push(maxIdx)
      }
      delta.push(deltaT)
      psi.push(psiT)
    }
    
    // 终止：找到最终的最大状态
    let maxState = 0
    let maxVal = delta[T - 1][0]
    for (let i = 1; i < this.numStates; i++) {
      if (delta[T - 1][i] > maxVal) {
        maxVal = delta[T - 1][i]
        maxState = i
      }
    }
    
    // 回溯
    const states = new Array(T)
    states[T - 1] = maxState
    for (let t = T - 2; t >= 0; t--) {
      states[t] = psi[t + 1][states[t + 1]]
    }
    
    return states
  }
  
  /**
   * 预测下一个观测状态
   * @param {number[]} observations - 观测序列
   * @returns {number} 预测的下一个观测状态
   */
  predictNextObservation(observations) {
    // 使用维特比算法解码当前状态
    const states = this.viterbi(observations)
    const lastState = states[states.length - 1]
    
    // 预测下一个观测状态（概率最大的观测）
    let maxProb = 0
    let maxObs = 0
    for (let j = 0; j < this.numObservations; j++) {
      if (this.emissionProb[lastState][j] > maxProb) {
        maxProb = this.emissionProb[lastState][j]
        maxObs = j
      }
    }
    
    return maxObs
  }
  
  /**
   * 预测下一个状态
   * @param {number[]} observations - 观测序列
   * @returns {number} 预测的下一个隐藏状态
   */
  predictNextState(observations) {
    // 使用维特比算法解码当前状态
    const states = this.viterbi(observations)
    const lastState = states[states.length - 1]
    
    // 根据转移概率预测下一个状态
    let maxProb = 0
    let maxState = 0
    for (let j = 0; j < this.numStates; j++) {
      if (this.transitionProb[lastState][j] > maxProb) {
        maxProb = this.transitionProb[lastState][j]
        maxState = j
      }
    }
    
    return maxState
  }
  
  /**
   * 计算状态概率分布
   * @param {number[]} observations - 观测序列
   * @returns {number[]} 当前状态的概率分布
   */
  getStateProbabilities(observations) {
    const T = observations.length
    const alpha = this.forward(observations)
    const beta = this.backward(observations)
    
    // 计算P(O)
    let pObs = 0
    for (let i = 0; i < this.numStates; i++) {
      pObs += alpha[T - 1][i]
    }
    
    // 计算最终状态的概率分布
    const probs = []
    for (let i = 0; i < this.numStates; i++) {
      probs.push((alpha[T - 1][i] * beta[T - 1][i]) / (pObs + 1e-10))
    }
    
    return probs
  }
  
  /**
   * 获取模型参数
   * @returns {Object} 模型参数
   */
  getParameters() {
    return {
      numStates: this.numStates,
      numObservations: this.numObservations,
      initialProb: this.initialProb,
      transitionProb: this.transitionProb,
      emissionProb: this.emissionProb,
    }
  }
  
  /**
   * 设置模型参数
   * @param {Object} params - 模型参数
   */
  setParameters(params) {
    this.numStates = params.numStates
    this.numObservations = params.numObservations
    this.initialProb = params.initialProb
    this.transitionProb = params.transitionProb
    this.emissionProb = params.emissionProb
  }
}

/**
 * 训练多个HMM模型（每个股票一个）
 * @param {Array} stockDataList - 股票数据列表（每个包含观测序列）
 * @param {number} numStates - 状态数量
 * @param {number} numObservations - 观测状态数量
 * @param {number} maxIterations - 最大迭代次数
 * @param {Object} options - 训练选项
 * @returns {Array} HMM模型数组
 */
export const trainMultipleHMMs = (
  stockDataList,
  numStates = 3,
  numObservations = 10,
  maxIterations = 50,
  options = {}
) => {
  const {
    baseSeed = 12345,           // 基础随机种子
    numRuns = 3,                // 每个股票训练次数（取最优）
    verbose = true,             // 是否输出详细日志
  } = options

  const models = []

  for (const stockData of stockDataList) {
    if (!stockData.observations || stockData.observations.length === 0) {
      console.warn(`股票 ${stockData.stock} 没有观测数据，跳过训练`)
      continue
    }

    if (verbose) {
      console.log(`开始训练 ${stockData.stock} 的HMM模型...`)
    }

    let bestHmm = null
    let bestLogLikelihood = -Infinity
    let bestSeed = 0
    let validRunCount = 0

    // 多次训练，选择对数似然最高的模型
    for (let run = 0; run < numRuns; run++) {
      // 为每次训练设置不同的种子
      const seed = baseSeed + stockData.id * 1000 + run
      setRandomSeed(seed)

      const hmm = new HMM(numStates, numObservations)
      hmm.randomInitialize(true)  // 使用种子随机数

      const logLikelihood = hmm.train(stockData.observations, maxIterations)

      // 检查训练是否成功（对数似然不能是-Infinity）
      if (logLikelihood !== -Infinity && logLikelihood !== null && !isNaN(logLikelihood)) {
        validRunCount++

        if (verbose && numRuns > 1) {
          console.log(`  Run ${run + 1}/${numRuns}: 种子=${seed}, 对数似然=${logLikelihood.toFixed(4)}`)
        }

        // 选择最优模型
        if (logLikelihood > bestLogLikelihood) {
          bestHmm = hmm
          bestLogLikelihood = logLikelihood
          bestSeed = seed
        }
      } else {
        console.warn(`  Run ${run + 1}/${numRuns}: 训练失败，对数似然=${logLikelihood}`)
      }
    }

    // 如果所有训练都失败，使用最后一次初始化的模型（至少保证有一个模型）
    if (bestHmm === null) {
      console.warn(`${stockData.stock}: 所有${numRuns}次训练均失败，使用最后一次初始化的模型`)
      bestHmm = new HMM(numStates, numObservations)
      bestHmm.randomInitialize(true)
      bestLogLikelihood = 0  // 设置一个默认值
      bestSeed = baseSeed + stockData.id * 1000
    }

    models.push({
      id: stockData.id,
      stock: stockData.stock,
      plate: stockData.plate,
      model: bestHmm,
      logLikelihood: bestLogLikelihood,
      seed: bestSeed,
    })

    if (verbose) {
      console.log(`${stockData.stock} HMM训练完成，对数似然: ${bestLogLikelihood.toFixed(4)} (种子=${bestSeed})`)
    }
  }

  return models
}

/**
 * 使用HMM模型预测
 * @param {HMM} hmm - HMM模型
 * @param {number[]} observations - 观测序列
 * @returns {Object} 预测结果
 */
export const predictWithHMM = (hmm, observations) => {
  const states = hmm.viterbi(observations)
  const stateProbs = hmm.getStateProbabilities(observations)
  const nextState = hmm.predictNextState(observations)
  const nextObservation = hmm.predictNextObservation(observations)
  
  return {
    states,
    stateProbs,
    currentState: states[states.length - 1],
    nextState,
    nextObservation,
  }
}
