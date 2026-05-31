package com.mora.dto.data;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserDataDeleteResponse {

    private long deletedBusinessCards;
    private long deletedTickets;
    private long deletedPosters;
    private long deletedReceipts;
    private long deletedSearchHistories;
    private long deletedGoogleCalendarMappings;
}
