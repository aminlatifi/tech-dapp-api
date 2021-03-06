const Accounts = require('web3-eth-accounts');
const models = require('./models');
const { getTermsAndConditionText } = require('./termsAndCondition');
const sendMail = require('./mail/dappMailer');
const whitelistService = require('./service/whitelist');

const accounts = new Accounts();

module.exports = (server) => {
  server.get('/signature/:address', (req, res) => {
    const { address } = req.params;
    console.log(`Get signature for ${address}`);

    models.signature
      .findOne({
        where: { address: address.toLowerCase() },
      })
      .then((instance) => {
        return res.send(
          200,
          instance.get({
            plain: true,
          }),
        );
      })
      // eslint-disable-next-line no-unused-vars
      .catch((e) => {
        return res.send(404);
      });
  });

  server.get('/whitelist/:address', (req, res) => {
    const { address } = req.params;

    console.log(`Get user is white listed for ${address}`);

    whitelistService(address)
      .then((r) => {
        console.log('response:', r);
        return res.send(200, { whitelisted: r });
      })
      .catch((e) => res.send(500, e));
  });

  // eslint-disable-next-line no-unused-vars
  server.post('/signature', async (req, res, next) => {
    const { body } = req;

    if (!body) {
      return req.send(401, 'Incorrect request format');
    }

    const { signature, message } = body;
    const address = body.address && body.address.toLowerCase();
    if (!address) {
      return res.send(401, 'address missing');
    }
    if (!signature) {
      return res.send(401, 'signature missing');
    }
    if (!message) {
      return res.send(401, 'message missing');
    }

    const termsAndCondition = await getTermsAndConditionText();

    if (termsAndCondition !== message) {
      return res.send(401, "message doesn't match with terms and condition");
    }

    const publicAddress = accounts.recover(message, signature);
    if (publicAddress.toLowerCase() !== address) {
      return res.send(401, 'message is not signed by claimed wallet address');
    }

    const result = await models.signature.findOne({
      where: { address },
    });

    if (!result || result.length === 0) {
      await models.signature.findOrCreate({
        where: { address },
        defaults: {
          message,
          address,
          signature,
        },
      });
      sendMail(address, signature);
      return res.send(200);
    }

    return res.send(401, 'Signature already exists');
  });
};
