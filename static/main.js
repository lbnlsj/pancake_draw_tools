// 图表相关变量
let chart;
let candlestickSeries;
let lastUpdateTime = new Date();

// 初始化图表
function initChart() {
    // 创建图表实例
    chart = LightweightCharts.createChart(document.getElementById('chart'), {
        width: document.getElementById('chart').clientWidth,
        height: 400,
        layout: {
            backgroundColor: '#ffffff',
            textColor: '#333',
        },
        grid: {
            vertLines: {
                color: 'rgba(197, 203, 206, 0.5)',
            },
            horzLines: {
                color: 'rgba(197, 203, 206, 0.5)',
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 1)',
            autoScale: true,
        },
        timeScale: {
            borderColor: 'rgba(197, 203, 206, 1)',
            timeVisible: true,
            secondsVisible: false,  // 不显示秒
        },
    });

    // 创建K线图系列
    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    // 开始定期更新市场数据
    updateMarketData();
    setInterval(updateMarketData, 1000);  // 每秒更新一次

    // 处理窗口大小变化
    window.addEventListener('resize', () => {
        chart.applyOptions({
            width: document.getElementById('chart').clientWidth,
        });
    });
}

// 更新市场数据
async function updateMarketData() {
    try {
        const response = await fetch('/api/market_data');
        const data = await response.json();

        // 更新K线图数据
        const chartData = [...data.price_history];
        if (data.current_candle) {
            chartData.push(data.current_candle);
        }
        candlestickSeries.setData(chartData);

        // 更新市场状态显示
        document.getElementById('tokenAReserve').textContent =
            Number(data.token_a_reserve).toLocaleString(undefined, {maximumFractionDigits: 2});
        document.getElementById('tokenBReserve').textContent =
            Number(data.token_b_reserve).toLocaleString(undefined, {maximumFractionDigits: 2});
        document.getElementById('currentPrice').textContent =
            Number(data.current_price).toFixed(6);
        document.getElementById('targetPriceDisplay').textContent =
            data.target_price ? Number(data.target_price).toFixed(6) : '-';

        // 根据自动交易状态更新UI
        updateAutoTradingUI(data.auto_trading, data.target_price);

    } catch (error) {
        console.error('更新市场数据失败:', error);
    }
}

// 更新自动交易UI状态
function updateAutoTradingUI(isAutoTrading, targetPrice) {
    const startButton = document.querySelector('button[onclick="startAutoTrading()"]');
    const stopButton = document.querySelector('button[onclick="stopAutoTrading()"]');
    const targetPriceInput = document.getElementById('targetPrice');

    if (isAutoTrading) {
        startButton.classList.add('opacity-50', 'cursor-not-allowed');
        stopButton.classList.remove('opacity-50', 'cursor-not-allowed');
        targetPriceInput.value = targetPrice;
        targetPriceInput.disabled = true;
    } else {
        startButton.classList.remove('opacity-50', 'cursor-not-allowed');
        stopButton.classList.add('opacity-50', 'cursor-not-allowed');
        targetPriceInput.disabled = false;
    }
}

// 执行手动交易
async function executeTrade(direction) {
    const amount = parseFloat(document.getElementById('tradeAmount').value);

    if (isNaN(amount) || amount <= 0) {
        alert('请输入有效的交易数量');
        return;
    }

    try {
        const response = await fetch('/api/execute_trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ direction, amount }),
        });

        const result = await response.json();
        if (!result.success) {
            alert('交易执行失败');
        }
    } catch (error) {
        console.error('交易请求失败:', error);
        alert('交易请求失败');
    }
}

// 开始自动交易（价格控制）
async function startAutoTrading() {
    const targetPrice = parseFloat(document.getElementById('targetPrice').value);

    if (isNaN(targetPrice) || targetPrice <= 0) {
        alert('请输入有效的目标价格');
        return;
    }

    try {
        const response = await fetch('/api/set_target_price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ price: targetPrice }),
        });

        const result = await response.json();
        if (!result.success) {
            alert('启动自动交易失败');
        }
    } catch (error) {
        console.error('启动自动交易请求失败:', error);
        alert('启动自动交易请求失败');
    }
}

// 停止自动交易
async function stopAutoTrading() {
    try {
        const response = await fetch('/api/stop_auto_trading', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();
        if (!result.success) {
            alert('停止自动交易失败');
        }
    } catch (error) {
        console.error('停止自动交易请求失败:', error);
        alert('停止自动交易请求失败');
    }
}

// 添加流动性
async function addLiquidity() {
    const amountA = parseFloat(document.getElementById('addAmountA').value);
    const amountB = parseFloat(document.getElementById('addAmountB').value);

    if (isNaN(amountA) || isNaN(amountB) || amountA <= 0 || amountB <= 0) {
        alert('请输入有效的数量');
        return;
    }

    try {
        const response = await fetch('/api/add_liquidity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount_a: amountA, amount_b: amountB }),
        });

        const result = await response.json();
        if (!result.success) {
            alert('添加流动性失败');
        }
    } catch (error) {
        console.error('添加流动性请求失败:', error);
        alert('添加流动性请求失败');
    }
}

// 移除流动性
async function removeLiquidity() {
    const percentage = parseFloat(document.getElementById('removePercentage').value);

    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        alert('请输入有效的百分比（1-100）');
        return;
    }

    try {
        const response = await fetch('/api/remove_liquidity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ percentage }),
        });

        const result = await response.json();
        if (!result.success) {
            alert('移除流动性失败');
        }
    } catch (error) {
        console.error('移除流动性请求失败:', error);
        alert('移除流动性请求失败');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initChart);