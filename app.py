from flask import Flask, render_template, jsonify, request
import random
from datetime import datetime, timedelta
import threading
import time

app = Flask(__name__)

# 模拟的市场状态
market_state = {
    'token_a_reserve': 1000000,  # Token A 储备
    'token_b_reserve': 1000000,  # Token B 储备
    'k_constant': 1000000 * 1000000,  # 恒定乘积
    'price_history': [],  # K线历史数据
    'current_candle': None,  # 当前K线
    'last_update': datetime.now(),
    'target_price': None,  # 目标价格
    'auto_trading': False  # 自动交易状态
}


def calculate_price():
    """计算当前价格"""
    return market_state['token_b_reserve'] / market_state['token_a_reserve']


def create_new_candle(timestamp):
    """创建新的K线"""
    current_price = calculate_price()
    return {
        'time': int(timestamp.timestamp()),
        'open': current_price,
        'high': current_price,
        'low': current_price,
        'close': current_price,
        'volume': 0
    }


def update_current_candle(trade_price, trade_volume):
    """更新当前K线"""
    if market_state['current_candle'] is None:
        market_state['current_candle'] = create_new_candle(datetime.now())

    candle = market_state['current_candle']
    candle['high'] = max(candle['high'], trade_price)
    candle['low'] = min(candle['low'], trade_price)
    candle['close'] = trade_price
    candle['volume'] += trade_volume


def market_maker():
    """市场维护线程，负责更新K线和执行自动交易"""
    while True:
        current_time = datetime.now()

        # 每分钟更新一次K线
        if (current_time - market_state['last_update']).total_seconds() >= 60:
            if market_state['current_candle'] is not None:
                market_state['price_history'].append(market_state['current_candle'])
                # 保持最近100根K线
                if len(market_state['price_history']) > 100:
                    market_state['price_history'] = market_state['price_history'][-100:]

            market_state['current_candle'] = create_new_candle(current_time)
            market_state['last_update'] = current_time

        # 如果开启了自动交易且设置了目标价格，执行价格控制
        if market_state['auto_trading'] and market_state['target_price'] is not None:
            current_price = calculate_price()
            price_diff = market_state['target_price'] - current_price

            if abs(price_diff) > 0.0001:  # 设置一个最小变动阈值
                # 根据价格差异决定交易方向和数量
                trade_amount = abs(price_diff) * market_state['token_a_reserve'] * 0.01
                if price_diff > 0:
                    execute_trade('buy', trade_amount)
                else:
                    execute_trade('sell', trade_amount)

        time.sleep(1)  # 控制更新频率


def execute_trade(direction, amount):
    """执行交易"""
    try:
        if direction == 'buy':
            new_token_a = market_state['token_a_reserve'] - amount
            new_token_b = market_state['k_constant'] / new_token_a
        else:
            new_token_a = market_state['token_a_reserve'] + amount
            new_token_b = market_state['k_constant'] / new_token_a

        market_state['token_a_reserve'] = new_token_a
        market_state['token_b_reserve'] = new_token_b

        # 更新K线
        update_current_candle(calculate_price(), amount)

        return True
    except Exception as e:
        print(f"交易执行错误: {e}")
        return False


@app.route('/')
def index():
    """渲染主页"""
    return render_template('index.html')


@app.route('/api/market_data')
def get_market_data():
    """获取市场数据"""
    current_price = calculate_price()
    data = {
        'price_history': market_state['price_history'],
        'current_candle': market_state['current_candle'],
        'token_a_reserve': market_state['token_a_reserve'],
        'token_b_reserve': market_state['token_b_reserve'],
        'current_price': current_price,
        'target_price': market_state['target_price'],
        'auto_trading': market_state['auto_trading']
    }
    return jsonify(data)


@app.route('/api/execute_trade', methods=['POST'])
def handle_trade():
    """处理交易请求"""
    data = request.json
    success = execute_trade(data['direction'], float(data['amount']))
    return jsonify({'success': success})


@app.route('/api/set_target_price', methods=['POST'])
def set_target_price():
    """设置目标价格"""
    data = request.json
    market_state['target_price'] = float(data['price'])
    market_state['auto_trading'] = True
    return jsonify({'success': True})


@app.route('/api/stop_auto_trading', methods=['POST'])
def stop_auto_trading():
    """停止自动交易"""
    market_state['auto_trading'] = False
    market_state['target_price'] = None
    return jsonify({'success': True})


@app.route('/api/add_liquidity', methods=['POST'])
def add_liquidity():
    """添加流动性"""
    data = request.json
    market_state['token_a_reserve'] += float(data['amount_a'])
    market_state['token_b_reserve'] += float(data['amount_b'])
    market_state['k_constant'] = market_state['token_a_reserve'] * market_state['token_b_reserve']
    return jsonify({'success': True})


@app.route('/api/remove_liquidity', methods=['POST'])
def remove_liquidity():
    """移除流动性"""
    data = request.json
    percentage = float(data['percentage']) / 100
    amount_a = market_state['token_a_reserve'] * percentage
    amount_b = market_state['token_b_reserve'] * percentage

    market_state['token_a_reserve'] -= amount_a
    market_state['token_b_reserve'] -= amount_b
    market_state['k_constant'] = market_state['token_a_reserve'] * market_state['token_b_reserve']
    return jsonify({'success': True})


if __name__ == '__main__':
    # 启动市场维护线程
    market_thread = threading.Thread(target=market_maker, daemon=True)
    market_thread.start()

    # 启动Flask应用
    app.run(debug=True, threaded=True)