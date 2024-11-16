import { ID, Query } from "appwrite";
import { databases } from "../appwrite/appwrite-config";

const actions = {
  ON_ADD_EXPENSE: "ON_ADD_EXPENSE",
  ON_REMOVE_EXPENSE: "ON_REMOVE_EXPENSE",
  ON_EDIT_EXPENSE: "ON_EDIT_EXPENSE",
};

/* To fetch data after any changes in the database or to fetch data into state on login*/
export async function fetchData() {
  try {
    // Fetch categories and expenses in parallel
    const [categories, expenses] = await Promise.all([
      databases.listDocuments(
        import.meta.env.VITE_DB_ID,
        import.meta.env.VITE_DB_CATEGORY_ID
      ),
      databases.listDocuments(
        import.meta.env.VITE_DB_ID, 
        import.meta.env.VITE_DB_EXPENSE_ID,
        [Query.limit(5)]
      )
    ]);

    return {
      expenses: expenses.documents,
      categories: categories.documents
    };

  } catch (error) {
    console.error("Error fetching data:", error);
    throw error; // Re-throw to allow error handling by caller
  }
}

/* To add a new category */
export function addCategory(userId, userEmail, categoryData) {
  const { name, type, subCategories } = categoryData;
  console.log(
    import.meta.env.VITE_DB_ID, // Database ID
    import.meta.env.VITE_DB_USER_ID, // User Collection ID
    userId
  );
  return async function (dispatch) {
    try {
      await databases.createDocument(
        import.meta.env.VITE_DB_ID, // Database ID
        import.meta.env.VITE_DB_CATEGORY_ID, // Category Collection ID
        ID.unique(), // Unique ID for the new document
        {
          name: name, // Category name
          userId: userId, // User ID reference
          userEmail: userEmail,
          type: type,
          subCategories: subCategories,
        }
      );

      // Delay dispatch to ensure the update is propagated
      setTimeout(() => dispatch(fetchData(userId)), 3000);
    } catch (error) {
      console.error("Error in addCategory:", error);
    }
  };
}

/* To edit an existing category name */
export function editCategoryName(categoryId, newCategoryName) {
  return function (dispatch) {
    const promise = databases.updateDocument(
      import.meta.env.VITE_DB_ID,
      import.meta.env.VITE_DB_CATEGORY_ID,
      categoryId,
      {
        name: newCategoryName,
      }
    );

    promise.then(
      (updatedCategoryDocument) => {
        const userId = updatedCategoryDocument.user.$id;
        setTimeout(() => dispatch(fetchData(userId)), 3000);
      },
      (error) => {
        console.log(error);
      }
    );
  };
}

/* To delete a category and all its related documents i.e. expenses and its reference in user collection */
export function deleteCategory(userId, categoryId) {
  return function (dispatch) {
    const promise = databases.deleteDocument(
      import.meta.env.VITE_DB_ID,
      import.meta.env.VITE_DB_CATEGORY_ID,
      categoryId
    );

    promise.then(
      function () {
        dispatch(updateUserTotalExpense(userId));
      },
      (error) => {
        console.log(error);
      }
    );
  };
}

/* To add an expense to a particular category (also updates the totalAmount of that category and fetch the updated data into the state) */
export function addExpense(
  userEmail,
  categoryId,
  expenseDetails,
  categoryName,
  userId
) {
  return async function (dispatch) {
    try {
      const { amount, name, description, date, amountType } = expenseDetails;
      const expenseData = {
        amount: parseInt(amount), // Ensure type matches Appwrite schema
        name: name,
        description: description,
        date: date,
        amountType: amountType,
        categoryId: categoryId,
        userEmail: userEmail,
      };
      await databases.createDocument(
        import.meta.env.VITE_DB_ID,
        import.meta.env.VITE_DB_EXPENSE_ID,
        ID.unique(),
        expenseData
      );

      dispatch(
        updateCategoryTotalExpense(actions.ON_ADD_EXPENSE, {
          userId,
          categoryId,
          amount,
        })
      );
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };
}

/* To edit an expense details (aslo updates the corresponding category's totalAmount and fetches the updated data into the state) */
export function editExpense(expenseId, expenseDetails, oldAmount) {
  return function (dispatch) {
    // updating the expense document
    const promise = databases.updateDocument(
      import.meta.env.VITE_DB_ID,
      import.meta.env.VITE_DB_EXPENSE_ID,
      expenseId,
      {
        ...expenseDetails,
      }
    );

    promise.then(
      (updatedExpenseDocument) => {
        const categoryId = updatedExpenseDocument.category.$id;
        const userId = updatedExpenseDocument.user.$id;
        const amount = parseInt(expenseDetails?.amount);

        const { year, month } = updatedExpenseDocument;
        const [currYear, currMonth] = [
          new Date().getFullYear(),
          new Date().getMonth(),
        ];
        const updateYearAmount = year === currYear;
        const updateMonthAmount = month === currMonth;

        dispatch(
          updateCategoryTotalExpense(actions.ON_EDIT_EXPENSE, {
            userId,
            categoryId,
            amount,
            oldAmount,
            updateMonthAmount,
            updateYearAmount,
          })
        );
      },
      (error) => {
        console.log(error);
      }
    );
  };
}

/* To delete an expense (also fetches the updated data into the state) */
export function removeExpense(expenseId, expenseDetails) {
  return function (dispatch) {
    const { year, month, categoryId, userId } = expenseDetails;
    const amount = parseInt(expenseDetails?.amount);

    // deleting an expense document
    const promise = databases.deleteDocument(
      import.meta.env.VITE_DB_ID,
      import.meta.env.VITE_DB_EXPENSE_ID,
      expenseId
    );

    promise.then(
      () => {
        const [currYear, currMonth] = [
          new Date().getFullYear(),
          new Date().getMonth(),
        ];

        const updateYearAmount = year === currYear;
        const updateMonthAmount = month === currMonth;

        dispatch(
          updateCategoryTotalExpense(actions.ON_REMOVE_EXPENSE, {
            userId,
            categoryId,
            amount,
            updateYearAmount,
            updateMonthAmount,
          })
        );
      },
      (error) => {
        console.log(error);
      }
    );
  };
}

export function updateCategoryTotalExpense(action, data) {
  return function (dispatch) {
    const { categoryId } = data;

    const promise = databases.getDocument(
      import.meta.env.VITE_DB_ID,
      import.meta.env.VITE_DB_CATEGORY_ID,
      categoryId
    );

    promise.then((categoryDocument) => {
      let [updatedCurrYearExpense, updatedCurrMonthExpense] = [
        categoryDocument.currYearExpense,
        categoryDocument.currMonthExpense,
      ];

      const { amount } = data;

      if (action === actions.ON_ADD_EXPENSE) {
        updatedCurrYearExpense += amount;
        updatedCurrMonthExpense += amount;
      } else if (action === actions.ON_EDIT_EXPENSE) {
        const { oldAmount, updateMonthAmount, updateYearAmount } = data;

        if (updateYearAmount) {
          updatedCurrYearExpense += amount - oldAmount;

          if (updateMonthAmount) {
            updatedCurrMonthExpense += amount - oldAmount;
          }
        }
      } else if (action === actions.ON_REMOVE_EXPENSE) {
        const { updateYearAmount, updateMonthAmount } = data;
        if (updateYearAmount) {
          updatedCurrYearExpense -= amount;
          if (updateMonthAmount) {
            updatedCurrMonthExpense -= amount;
          }
        }
      }

      const promise = databases.updateDocument(
        import.meta.env.VITE_DB_ID,
        import.meta.env.VITE_DB_CATEGORY_ID,
        categoryId,
        {
          currYearExpense: updatedCurrYearExpense,
          currMonthExpense: updatedCurrMonthExpense,
        }
      );

      promise.then(
        () => {
          const { userId } = data;
          dispatch(updateUserTotalExpense(userId));
        },
        (error) => console.log(error)
      );
    });
  };
}

export function updateUserTotalExpense(userId) {
  return function (dispatch) {
    const promise = databases.getDocument(
      import.meta.env.VITE_DB_ID,
      import.meta.env.VITE_DB_USER_ID,
      userId
    );

    promise.then((userDocument) => {
      const categories = userDocument?.categories;

      let [updatedCurrYearExpense, updatedCurrMonthExpense] = [0, 0];

      categories.forEach((category) => {
        updatedCurrYearExpense += category.currYearExpense;
        updatedCurrMonthExpense += category.currMonthExpense;
      });

      const promise = databases.updateDocument(
        import.meta.env.VITE_DB_ID,
        import.meta.env.VITE_DB_USER_ID,
        userId,
        {
          currYearExpense: updatedCurrYearExpense,
          currMonthExpense: updatedCurrMonthExpense,
        }
      );

      promise.then(
        () => {
          dispatch(fetchData(userId));
        },
        (error) => console.log(error)
      );
    });
  };
}
