const Binance = require("./binance");
const { request, gql } = require("graphql-request");
const { moonbaseGraph, candleGraph } = require("./const");
class UDFError extends Error {}
class SymbolNotFound extends UDFError {}
class InvalidResolution extends UDFError {}

class UDF {
  constructor() {
    this.binance = new Binance();
    this.supportedResolutions = [
      // "1",
      // "3",
      // "5",
      // "15",
      // "30",
      "60",
      // "120",
      "240",
      // "360",
      // "480",
      // "720",
      "1D",
      // "3D",
      "1W",
      // "1M",
    ];

    setInterval(() => {
      this.loadSymbols();
    }, 30000);
    this.loadSymbols();
  }

  loadSymbols() {
    const chartQuery = gql`
      query MyQuery {
        pairs {
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
        }
      }
    `;
    try {
      // const result = await request(moonbaseGraph, chartQuery);
      // const pairs = result?.pairs ?? [];

      this.symbols = request(moonbaseGraph, chartQuery).then((results) =>
        results?.pairs.map((pair) => ({
          symbol: `${pair.token0.symbol}${pair.token1.symbol}`,
          ticker: `${pair.token0.symbol}${pair.token1.symbol}`,
          name: `${pair.token0.symbol}${pair.token1.symbol}`,
          full_name: `${pair.token0.symbol}${pair.token1.symbol}`,
          description: `${pair.token0.symbol}${pair.token1.symbol}`,
          exchange: "MOONBASEALPHA",
          listed_exchange: "MOONBASEALPHA",
          type: "crypto",
          currency_code: pair.token1.symbol,
          session: "24x7",
          timezone: "UTC",
          minmovement: 1,
          minmov: 1,
          minmovement2: 0,
          minmov2: 0,
          pricescale: 1,
          supported_resolutions: this.supportedResolutions,
          has_intraday: true,
          has_daily: true,
          has_weekly_and_monthly: true,
          token0: pair.token0.id,
          token1: pair.token1.id,
        }))
      );
      this.allSymbols = request(moonbaseGraph, chartQuery).then((results) => {
        let set = new Set();
        for (const pair of results.pairs) {
          set.add(`${pair.token0.symbol}${pair.token1.symbol}`);
        }
        return set;
      });
      // this.allSymbols = new Set(this.symbols.map((symbol) => symbol.symbol));
    } catch (error) {
      console.error("Error fetching symbols:", error);
      setTimeout(() => {
        this.loadSymbols();
      }, 30000);
    }

    // function pricescale(symbol) {
    //   for (let filter of symbol.filters) {
    //     if (filter.filterType == "PRICE_FILTER") {
    //       return Math.round(1 / parseFloat(filter.tickSize));
    //     }
    //   }
    //   return 1;
    // }
    // const promise = this.binance.exchangeInfo().catch((err) => {
    //   console.error(err);
    //   setTimeout(() => {
    //     this.loadSymbols();
    //   }, 1000);
    // });
    // this.symbols = promise.then((info) => {
    //   return info.symbols.map((symbol) => {
    //     return {
    //       symbol: symbol.symbol,
    //       ticker: symbol.symbol,
    //       name: symbol.symbol,
    //       full_name: symbol.symbol,
    //       description: `${symbol.baseAsset} / ${symbol.quoteAsset}`,
    //       exchange: "BINANCE",
    //       listed_exchange: "BINANCE",
    //       type: "crypto",
    //       currency_code: symbol.quoteAsset,
    //       session: "24x7",
    //       timezone: "UTC",
    //       minmovement: 1,
    //       minmov: 1,
    //       minmovement2: 0,
    //       minmov2: 0,
    //       pricescale: pricescale(symbol),
    //       supported_resolutions: this.supportedResolutions,
    //       has_intraday: true,
    //       has_daily: true,
    //       has_weekly_and_monthly: true,
    //       data_status: "streaming",
    //     };
    //   });
    // });
    // this.allSymbols = promise.then((info) => {
    //   let set = new Set();
    //   for (const symbol of info.symbols) {
    //     set.add(symbol.symbol);
    //   }
    //   return set;
    // });
  }

  async checkSymbol(symbol) {
    const symbols = await this.allSymbols;
    return symbols.has(symbol);
  }

  /**
   * Convert items to response-as-a-table format.
   * @param {array} items - Items to convert.
   * @returns {object} Response-as-a-table formatted items.
   */
  asTable(items) {
    let result = {};
    for (const item of items) {
      for (const key in item) {
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(item[key]);
      }
    }
    for (const key in result) {
      const values = [...new Set(result[key])];
      if (values.length === 1) {
        result[key] = values[0];
      }
    }
    return result;
  }

  /**
   * Data feed configuration data.
   */
  async config() {
    return {
      exchanges: [
        {
          value: "MOONBASEALPHA",
          name: "Moonbase Alpha",
          desc: "Moonbase Alpha Exchange",
        },
      ],
      symbols_types: [
        {
          value: "crypto",
          name: "Cryptocurrency",
        },
      ],
      supported_resolutions: this.supportedResolutions,
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
    };
  }

  /**
   * Symbols.
   * @returns {object} Response-as-a-table formatted symbols.
   */
  async symbolInfo() {
    const symbols = await this.symbols;
    return this.asTable(symbols);
  }

  /**
   * Symbol resolve.
   * @param {string} symbol Symbol name or ticker.
   * @returns {object} Symbol.
   */
  async symbol(symbol) {
    const symbols = await this.symbols;

    const comps = symbol.split(":");
    const s = (comps.length > 1 ? comps[1] : symbol).toUpperCase();

    for (const symbol of symbols) {
      if (symbol.symbol === s) {
        return symbol;
      }
    }

    throw new SymbolNotFound();
  }

  /**
   * Symbol search.
   * @param {string} query Text typed by the user in the Symbol Search edit box.
   * @param {string} type One of the symbol types supported by back-end.
   * @param {string} exchange One of the exchanges supported by back-end.
   * @param {number} limit The maximum number of symbols in a response.
   * @returns {array} Array of symbols.
   */
  async search(query, type, exchange, limit) {
    let symbols = await this.symbols;
    if (type) {
      symbols = symbols.filter((s) => s.type === type);
    }
    if (exchange) {
      symbols = symbols.filter((s) => s.exchange === exchange);
    }

    query = query.toUpperCase();
    symbols = symbols.filter((s) => s.symbol.indexOf(query) >= 0);

    if (limit) {
      symbols = symbols.slice(0, limit);
    }
    return symbols.map((s) => ({
      symbol: s.symbol,
      full_name: s.full_name,
      description: s.description,
      exchange: s.exchange,
      ticker: s.ticker,
      type: s.type,
    }));
  }

  /**
   * Bars.
   * @param {string} symbol - Symbol name or ticker.
   * @param {number} from - Unix timestamp (UTC) of leftmost required bar.
   * @param {number} to - Unix timestamp (UTC) of rightmost required bar.
   * @param {string} resolution
   */
  async history(symbol, from, to, resolution) {
    const hasSymbol = await this.checkSymbol(symbol);
    if (!hasSymbol) {
      throw new SymbolNotFound();
    }

    const RESOLUTIONS_INTERVALS_MAP = {
      // 1: "1m",
      // 3: "3m",
      5: 60 * 5,
      15: 60 * 15,
      // 30: "30m",
      60: 60 * 60,
      // 120: "2h",
      240: 60 * 60 * 4,
      // 360: "6h",
      // 480: "8h",
      // 720: "12h",
      D: 60 * 60 * 24,
      "1D": 60 * 60 * 24,
      // "3D": "3d",
      W: 60 * 60 * 24 * 7,
      "1W": 60 * 60 * 24 * 7,
      // M: "1M",
      // "1M": "1M",
    };

    const interval = RESOLUTIONS_INTERVALS_MAP[resolution];
    if (!interval) {
      throw new InvalidResolution();
    }

    // const tokenQuery = gql`
    //   query MyQuery {
    //     tokens(where: { symbol_in: ["ARB", "USDC"] }) {
    //       id
    //       name
    //     }
    //   }
    // `;

    // const tokenResult = await request(moonbaseGraph, tokenQuery);
    // const token0 = tokenResult.tokens[0].id;
    // const token1 = tokenResult.tokens[1].id;
    const symbolDetail = await this.symbol(symbol);
    const candlesQuery = gql`
      {
        candles(
          first: 1000
          orderBy: time
          orderDirection: asc
          where: {
            time_gte: ${from}
            time_lte: ${to}
            period: ${interval}
            token0: "${symbolDetail.token0}"
            token1: "${symbolDetail.token1}"
          }
        ) {
          id
          time
          period
          lastBlock
          token0
          token1
          low
          open
          high
          close
        }
      }
    `;
    console.log("request sent");

    const candlesResult = await request(candleGraph, candlesQuery);
    const candles = candlesResult?.candles ?? [];
    // console.log(candles, "candles");
    console.log("request received");

    if (candles.length === 0) {
      return { s: "no_data" };
    }

    const bars = [];
    // console.log(bars, "bars");
    for (const candle of candles) {
      const bar = {
        time: Math.abs(Math.floor(candle.time)),
        close: parseFloat(candle.close),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        volume: parseFloat(candle.period),
      };
      bars.push(bar);
    }

    if (bars.length === 0) {
      return { s: "no_data" };
    } else {
      const returnData = {
        s: "ok",
        t: bars.map((bar) => bar.time),
        c: bars.map((bar) => bar.close),
        o: bars.map((bar) => bar.open),
        h: bars.map((bar) => bar.high),
        l: bars.map((bar) => bar.low),
        v: bars.map((bar) => bar.volume),
      };
      return returnData;
    }
  }
}

UDF.Error = UDFError;
UDF.SymbolNotFound = SymbolNotFound;
UDF.InvalidResolution = InvalidResolution;

module.exports = UDF;
