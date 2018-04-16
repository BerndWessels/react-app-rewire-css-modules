const path = require('path');
const cloneDeep = require('lodash.clonedeep');

const ruleChildren = (loader) => loader.use || loader.oneOf || Array.isArray(loader.loader) && loader.loader || [];

const findIndexAndRules = (rulesSource, ruleMatcher) => {
    let result = undefined;
    const rules = Array.isArray(rulesSource) ? rulesSource : ruleChildren(rulesSource);
    rules.some((rule, index) => result = ruleMatcher(rule) ? {
        index,
        rules
    } : findIndexAndRules(ruleChildren(rule), ruleMatcher));
    return result;
};

const findRule = (rulesSource, ruleMatcher) => {
    const {index, rules} = findIndexAndRules(rulesSource, ruleMatcher);
    return rules[index];
};

const cssRuleMatcher = (rule) => rule.test && String(rule.test) === String(/\.css$/);

const createLoaderMatcher = (loader) => (rule) => rule.loader && rule.loader.indexOf(`${path.sep}${loader}${path.sep}`) !== -1;
const cssLoaderMatcher = createLoaderMatcher('css-loader');
const postcssLoaderMatcher = createLoaderMatcher('postcss-loader');
const resolveUrlLoaderMatcher = createLoaderMatcher('resolve-url-loader');
const fileLoaderMatcher = createLoaderMatcher('file-loader');

const addAfterRule = (rulesSource, ruleMatcher, value) => {
    const {index, rules} = findIndexAndRules(rulesSource, ruleMatcher);
    rules.splice(index + 1, 0, value);
};

const addBeforeRule = (rulesSource, ruleMatcher, value) => {
    const {index, rules} = findIndexAndRules(rulesSource, ruleMatcher);
    rules.splice(index, 0, value);
};

module.exports = function (includePaths) {
    return function (config, env) {

        // Get the original css rule.
        const cssRule = findRule(config.module.rules, cssRuleMatcher);

        // Create and attach the new css modules rule.
        const cssModulesRule = cloneDeep(cssRule);

        const cssModulesRuleCssLoader = findRule(cssModulesRule, cssLoaderMatcher);
        cssModulesRuleCssLoader.options = Object.assign({
            modules: true,
            localIdentName: '[local]___[hash:base64:5]'
        }, cssModulesRuleCssLoader.options);
        addBeforeRule(config.module.rules, fileLoaderMatcher, cssModulesRule);

        // Update the original css rule.
        cssRule.exclude = /\.module\.css$/;

        // Create and attach the new sass rule.
        const sassRule = cloneDeep(cssRule);

        sassRule.test = /\.s[ac]ss$/;
        sassRule.exclude = /\.module\.s[ac]ss$/;
        addAfterRule(sassRule, postcssLoaderMatcher, {
            loader: require.resolve('resolve-url-loader'),
            options: {
                sourceMap: true
            }
        });
        addAfterRule(sassRule, resolveUrlLoaderMatcher, {
            loader: require.resolve('sass-loader'),
            options: {
                sourceMap: true,
                includePaths
            }
        });
        const sassRulePostcssLoader = findRule(sassRule, postcssLoaderMatcher);
        sassRulePostcssLoader.options = Object.assign({
            sourceMap: true
        }, sassRulePostcssLoader.options);

        addBeforeRule(config.module.rules, fileLoaderMatcher, sassRule);

        // Create and attach the new sass modules rule.
        const sassModulesRule = cloneDeep(cssModulesRule);

        sassModulesRule.test = /\.module\.s[ac]ss$/;
        addAfterRule(sassModulesRule, postcssLoaderMatcher, {
            loader: require.resolve('resolve-url-loader'),
            options: {
                sourceMap: true
            }
        });
        addAfterRule(sassModulesRule, resolveUrlLoaderMatcher, {
            loader: require.resolve('sass-loader'),
            options: {
                sourceMap: true,
                includePaths
            }
        });
        const sassModulesRulePostcssLoader = findRule(sassModulesRule, postcssLoaderMatcher);
        sassModulesRulePostcssLoader.options = Object.assign({
            sourceMap: true
        }, sassModulesRulePostcssLoader.options);

        addBeforeRule(config.module.rules, fileLoaderMatcher, sassModulesRule);

        return config;
    };
};
