const sdk = require("node-appwrite");

/*
  'req' variable has:
    'headers' - object with request headers
    'payload' - request body data as a string
    'variables' - object with function variables

  'res' variable has:
    'send(text, status)' - function to return text response. Status code defaults to 200
    'json(obj, status)' - function to return JSON response. Status code defaults to 200

  If an error is thrown, a response with code 500 will be returned.
*/

module.exports = async function (req, res) {
  const client = new sdk.Client();

  // You can remove services you don't use
  const database = new sdk.Databases(client);

  const { userId } = JSON.parse(req.payload);

  if (
    !req.variables["APPWRITE_FUNCTION_ENDPOINT"] ||
    !req.variables["APPWRITE_FUNCTION_API_KEY"]
  ) {
    console.warn(
      "Environment variables are not set. Function cannot use Appwrite SDK."
    );
  } else {
    client
      .setEndpoint(req.variables["APPWRITE_FUNCTION_ENDPOINT"])
      .setProject(req.variables["APPWRITE_FUNCTION_PROJECT_ID"])
      .setKey(req.variables["APPWRITE_FUNCTION_API_KEY"])
      .setSelfSigned(true);

    const promise = database.getDocument(
      req.variables["APPWRITE_DB_ID"],
      req.variables["APPWRITE_DB_USER_ID"],
      userId
    );

    promise.then((userDocument) => {
      const categories = userDocument.categories;
      let [currYearExpense, currMonthExpense] = [0, 0];

      categories.forEach((category) => {
        currYearExpense += category.currYearExpense;
        currMonthExpense += category.currMonthExpense;
      });

      database
        .updateDocument(
          req.variables["APPWRITE_DB_ID"],
          req.variables["APPWRITE_DB_USER_ID"],
          userId,
          {
            currYearExpense: currYearExpense,
            currMonthExpense: currMonthExpense,
          }
        )
        .then(
          (updatedUserDocument) => {
            return res.json(updatedUserDocument);
          },
          (error) => {
            return res.json({ error });
          }
        );
    });
  }
};
