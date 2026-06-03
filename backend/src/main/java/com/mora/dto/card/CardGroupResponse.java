package com.mora.dto.card;

import com.mora.entity.BusinessCardGroup;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CardGroupResponse {
    private UUID id;
    private String name;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CardGroupResponse from(BusinessCardGroup group) {
        return new CardGroupResponse(
                group.getId(),
                group.getName(),
                group.getCreatedAt(),
                group.getUpdatedAt()
        );
    }
}
